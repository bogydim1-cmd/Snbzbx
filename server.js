/**
 * PixelWall — buy pixels, leave your mark forever
 * One-file GitHub demo
 */

const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
const stripe = new Stripe('STRIPE_SECRET_KEY'); // 🔴 заменить
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ================= DATABASE =================
const db = new sqlite3.Database('./pixels.db');
db.run(`
CREATE TABLE IF NOT EXISTS pixels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x INTEGER,
  y INTEGER,
  size INTEGER,
  image TEXT
)`);

// ================= UPLOAD =================
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
app.use('/uploads', express.static('uploads'));

// ================= HTML =================
const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>PixelWall</title>
<style>
body {
  margin: 0;
  font-family: Inter, sans-serif;
  background: #0e0e14;
  color: white;
  text-align: center;
}
header {
  padding: 40px;
}
button {
  background: linear-gradient(90deg, #6a5cff, #00d4ff);
  border: none;
  padding: 15px 30px;
  color: white;
  font-size: 16px;
  border-radius: 12px;
  cursor: pointer;
}
canvas {
  border: 1px solid #333;
  background: #111;
  margin-bottom: 30px;
}
</style>
</head>
<body>

<header>
  <h1>PixelWall</h1>
  <p>Купи пиксели. Оставь след в интернете навсегда.</p>
  <button onclick="buy()">Купить пиксели</button>
</header>

<canvas id="wall" width="600" height="600"></canvas>
<input type="file" id="file" accept="image/png,image/jpeg" hidden>

<script>
const canvas = document.getElementById('wall');
const ctx = canvas.getContext('2d');
const file = document.getElementById('file');

fetch('/pixels').then(r => r.json()).then(data => {
  data.forEach(p => {
    const img = new Image();
    img.src = '/uploads/' + p.image;
    img.onload = () =>
      ctx.drawImage(img, p.x, p.y, p.size, p.size);
  });
});

function buy() {
  const pixels = prompt('Сколько пикселей купить? (мин 10)');
  if (!pixels || pixels < 10) return alert('Минимум 10 пикселей');
  file.click();
}

file.onchange = () => {
  const form = new FormData();
  form.append('image', file.files[0]);
  form.append('x', Math.random() * 500);
  form.append('y', Math.random() * 500);
  form.append('size', 100);

  fetch('/upload', { method: 'POST', body: form })
    .then(() => location.reload());
};
</script>

</body>
</html>
`;

// ================= ROUTES =================
app.get('/', (_, res) => res.send(html));

app.get('/pixels', (_, res) => {
  db.all(`SELECT * FROM pixels`, (err, rows) => res.json(rows));
});

app.post('/upload', upload.single('image'), (req, res) => {
  const { x, y, size } = req.body;
  db.run(
    `INSERT INTO pixels (x, y, size, image)
     VALUES (?, ?, ?, ?)`,
    [x, y, size, req.file.filename]
  );
  res.json({ success: true });
});

// ================= PAYMENT =================
app.post('/pay', async (req, res) => {
  const { pixels } = req.body;
  if (pixels < 10) return res.status(400).json({ error: 'min 10 pixels' });

  const amount = pixels * 5; // $0.05 * 100
  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd'
  });

  res.json({ clientSecret: intent.client_secret });
});

// ================= START =================
app.listen(PORT, () =>
  console.log('PixelWall running on http://localhost:' + PORT)
);
