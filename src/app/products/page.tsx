"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, Pencil, Download, Upload, FileSpreadsheet } from "lucide-react"
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Product } from "@/types"
import { productSchema } from "@/lib/validations-product"
import * as XLSX from "xlsx"

import { MainNav } from "@/components/MainNav"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ProductFormValues = z.infer<typeof productSchema>

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      ingredients: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ingredients"
  })

  // Watch ingredients to calculate estimated cost
  const watchedIngredients = watch("ingredients")

  // Load Products
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]
      setProducts(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Calculate Material Cost automatically if ingredients exist
  useEffect(() => {
    if (watchedIngredients && watchedIngredients.length > 0) {
      let totalCost = 0
      watchedIngredients.forEach(ing => {
        const product = products.find(p => p.id === ing.productId)
        if (product) {
          totalCost += (product.materialCost || 0) * ing.quantity
        }
      })
      if (totalCost > 0) {
        setValue("materialCost", totalCost)
      }
    }
  }, [watchedIngredients, products, setValue])

  // Populate form when editing
  useEffect(() => {
    if (editingProduct) {
      setValue("name", editingProduct.name)
      setValue("brand", editingProduct.brand || "")
      setValue("price", editingProduct.price)
      setValue("priceSppg5", editingProduct.priceSppg5 || 0)
      setValue("priceSppg3", editingProduct.priceSppg3 || 0)
      setValue("priceAlHam", editingProduct.priceAlHam || 0)
      setValue("materialCost", editingProduct.materialCost || 0)
      setValue("unit", editingProduct.unit)
      setValue("category", editingProduct.category || "")
      setValue("ingredients", editingProduct.ingredients || [])
    } else {
      reset({ 
        name: "", 
        brand: "",
        price: 0, 
        priceSppg5: 0, 
        priceSppg3: 0, 
        priceAlHam: 0, 
        materialCost: 0, 
        unit: "kg", 
        category: "",
        ingredients: [] 
      })
    }
  }, [editingProduct, setValue, reset])

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), {
          ...data,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, "products"), {
          ...data,
          createdAt: serverTimestamp(),
        })
      }
      setDialogOpen(false)
      setEditingProduct(null)
      reset()
    } catch (error) {
      console.error("Error saving product:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteDoc(doc(db, "products", id))
    }
  }

  const handleExport = () => {
    const data = products.map(p => ({
      Name: p.name,
      Brand: p.brand || "",
      Unit: p.unit,
      "Price (General)": p.price,
      "Price (SPPG 5 & 2)": p.priceSppg5 || 0,
      "Price (SPPG 3)": p.priceSppg3 || 0,
      "Price (Al Ham)": p.priceAlHam || 0,
      "Material Cost (HPP)": p.materialCost || 0,
      Category: p.category || "",
      Ingredients: p.ingredients ? p.ingredients.map(i => `${i.name}:${i.quantity}`).join(", ") : ""
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Products")
    XLSX.writeFile(wb, `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as any[]

        const batch = writeBatch(db) // Note: Firestore batch is limited to 500 ops
        let count = 0

        for (const row of data) {
          // Map Excel columns to Product fields
          const productData = {
            name: row["Name"] || row["name"],
            brand: row["Brand"] || row["brand"] || "",
            unit: row["Unit"] || row["unit"] || "kg",
            price: Number(row["Price (General)"] || row["price"] || 0),
            priceSppg5: Number(row["Price (SPPG 5 & 2)"] || row["Price (SPPG 5)"] || row["priceSppg5"] || 0),
            priceSppg3: Number(row["Price (SPPG 3)"] || row["priceSppg3"] || 0),
            priceAlHam: Number(row["Price (Al Ham)"] || row["priceAlHam"] || 0),
            materialCost: Number(row["Material Cost (HPP)"] || row["materialCost"] || 0),
            category: row["Category"] || row["category"] || "",
            createdAt: serverTimestamp(),
          }

          if (productData.name) {
            // Check if exists to update or add (Simple check by name could be done here but for now just add new)
            // Ideally we should use ID if provided or check name uniqueness
            const newRef = doc(collection(db, "products"))
            batch.set(newRef, productData)
            count++
          }
        }

        await batch.commit()
        alert(`Successfully imported ${count} products!`)
        if (fileInputRef.current) fileInputRef.current.value = ""
      } catch (error) {
        console.error("Error importing:", error)
        alert("Error importing file. Please check format.")
      }
    }
    reader.readAsBinaryString(file)
  }

  const downloadTemplate = () => {
    const template = [
      {
        Name: "Wortel",
        Brand: "Lokal",
        Unit: "kg",
        "Price (General)": 15000,
        "Price (SPPG 5 & 2)": 14000,
        "Price (SPPG 3)": 14500,
        "Price (Al Ham)": 14500,
        "Material Cost (HPP)": 10000,
        Category: "Sayuran"
      },
      {
        Name: "Mix Vegetable",
        Brand: "Premium",
        Unit: "pck",
        "Price (General)": 25000,
        "Price (SPPG 5 & 2)": 24000,
        "Price (SPPG 3)": 24500,
        "Price (Al Ham)": 24500,
        "Material Cost (HPP)": 18000,
        Category: "Frozen"
      }
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, "product_template.xlsx")
  }

  return (
    <div className="container mx-auto py-10 space-y-8 px-4">
      <MainNav />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daftar Harga (Products)</h1>
          <p className="text-muted-foreground">Manage price list, brands, and ingredients.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Template
          </Button>
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleImport}
              ref={fileInputRef}
            />
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setEditingProduct(null)
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription>
                  Configure product details, prices, and ingredients.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input id="name" {...register("name")} placeholder="e.g. Singkong" />
                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand / Merk</Label>
                    <Input id="brand" {...register("brand")} placeholder="e.g. ABC" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Default Price</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      {...register("price", { valueAsNumber: true })} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceSppg5">Price SPPG 5 & 2</Label>
                    <Input 
                      id="priceSppg5" 
                      type="number" 
                      {...register("priceSppg5", { valueAsNumber: true })} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceSppg3">Price SPPG 3</Label>
                    <Input 
                      id="priceSppg3" 
                      type="number" 
                      {...register("priceSppg3", { valueAsNumber: true })} 
                      placeholder="0" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceAlHam">Price Al Ham</Label>
                    <Input 
                      id="priceAlHam" 
                      type="number" 
                      {...register("priceAlHam", { valueAsNumber: true })} 
                      placeholder="0" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="materialCost">Material Cost / HPP</Label>
                    <Input 
                      id="materialCost" 
                      type="number" 
                      {...register("materialCost", { valueAsNumber: true })} 
                      placeholder="0" 
                      readOnly={fields.length > 0} // Read only if calculated from ingredients
                      className={fields.length > 0 ? "bg-muted" : ""}
                    />
                    {fields.length > 0 && <p className="text-xs text-muted-foreground">Calculated from ingredients</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input id="unit" {...register("unit")} placeholder="e.g. kg, pcs" />
                  </div>
                </div>

                {/* Ingredients Section */}
                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Ingredients / Komposisi (Optional)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", name: "", quantity: 1 })}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                  
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Item</Label>
                        <Select 
                          onValueChange={(val) => {
                            const p = products.find(p => p.id === val)
                            if (p) {
                              setValue(`ingredients.${index}.productId`, val)
                              setValue(`ingredients.${index}.name`, p.name)
                            }
                          }}
                          defaultValue={field.productId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ingredient" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.filter(p => p.id !== editingProduct?.id).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })} 
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {fields.length > 0 && (
                    <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                      HPP will be automatically calculated based on the ingredients&apos; Material Cost.
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit">Save Product</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Price (Gen)</TableHead>
              <TableHead>Price (SPPG 5&2)</TableHead>
              <TableHead>Price (SPPG 3)</TableHead>
              <TableHead>Price (Al Ham)</TableHead>
              <TableHead>HPP</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  {product.name}
                  {product.ingredients && product.ingredients.length > 0 && (
                    <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1 rounded">Composite</span>
                  )}
                </TableCell>
                <TableCell>{product.brand || "-"}</TableCell>
                <TableCell>{product.unit}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(product.price)}
                </TableCell>
                <TableCell>
                  {product.priceSppg5 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(product.priceSppg5) : "-"}
                </TableCell>
                <TableCell>
                  {product.priceSppg3 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(product.priceSppg3) : "-"}
                </TableCell>
                <TableCell>
                  {product.priceAlHam ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(product.priceAlHam) : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.materialCost ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(product.materialCost) : "-"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditingProduct(product)
                    setDialogOpen(true)
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No products found. Import or add one to start.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
