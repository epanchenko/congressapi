const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  process.exit(1);
});

dotenv.config({
  path: './config.env',
});

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {});

const app = require('./app');

const port = process.env.PORT || 8081;
const startServer = () => {
  try {
    app.listen(port, () => {
      console.log(`App running on port ${port}`);
    });
  } catch (err) {}
};

const server = startServer();

//node.js errors
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED.  Shutting down gracefully.');
  server.close(() => {
    console.log('Process terminated');
  });
});
