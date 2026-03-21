fetch('https://api.telegram.org/bot8671171673:AAGqI3BacRQEeKm1YrVdhmqTKtiBA6S-B84/deleteWebhook')
  .then(res => res.json())
  .then(data => {
    console.log('Webhook deletion response:', data);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to delete webhook:', err);
    process.exit(1);
  });
