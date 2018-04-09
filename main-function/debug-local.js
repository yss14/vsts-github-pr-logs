const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const azureFunction = require('./index');

dotenv.config({
    path: `${process.cwd()}/dev.env`
});

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.disable('x-powered-by');

const port = process.env.PORT || 3500;

app.post('/main-function', (req, res) => {
    azureFunction(
        {
            res: res,
            log: console.log,
            error: console.err,
            done: (ctx) => {
                res.json(ctx.res.body).status(200).end();
            }
        },
        req
    );
});

const httpServer = http.createServer(app).listen(port, () => {
    console.log(`Server is listening on ${port}`);
});