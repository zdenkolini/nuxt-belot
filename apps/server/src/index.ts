import { app } from './app';

app.listen(Number(process.env.PORT ?? 3000));

console.log(`Server listening on ${app.server?.url}`);
