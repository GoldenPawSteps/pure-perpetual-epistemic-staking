import { createServerApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const app = createServerApp();

app.listen(port, () => {
  console.log(`PPES auth API listening on http://localhost:${port}`);
});