const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/twitch', () => {
  
});

app.listen(PORT, () => {
  console.log(`Example app listening...${PORT}`);
});