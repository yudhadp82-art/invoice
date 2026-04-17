import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiCheck, FiChevronDown } from 'react-icons/fi';

/**
 * SearchableSelect - A premium type-to-search dropdown component.
 */
export default function SearchableSelect({ 
  options = [], 
  value = '', 
  displayValue = '',
  onChange, 
  placeholder = 'Cari...', 
  className = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find(o => String(o.id) === String(value));
  const displayName = selectedOption ? selectedOption.name : displayValue;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    (o.name || '').toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(opt) {
    onChange(opt.id);
    setSearch('');
    setIsOpen(false);
    setHighlightIdx(-1);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIdx(prev => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightIdx >= 0) {
        handleSelect(filteredOptions[highlightIdx]);
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className={`searchable-select-container ${className}`} ref={containerRef}>
      <div className="searchable-select-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="form-input searchable-select-input font-bold"
          placeholder={placeholder}
          value={isOpen ? search : displayName}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          required={required && !value}
        />
        <div className="searchable-select-icon">
          {isOpen ? (
            <FiSearch className="opacity-40" />
          ) : (
            <FiChevronDown className="opacity-40" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="searchable-select-dropdown animate-in shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className={`searchable-select-option ${idx === highlightIdx ? 'highlighted' : ''} ${String(value) === String(opt.id) ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                {opt.name}
              </div>
            ))
          ) : (
            <div className="searchable-select-no-results">
              Tidak ada hasil untuk "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
