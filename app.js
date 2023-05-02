const { response } = require('express');
const express = require('express');
const app = express();
const admin = require('firebase-admin');
//const credentials = require('./key.json');
const multer = require('multer');
var exceltojson = require('convert-excel-to-json');
const path = require('path');
const xlsx = require('node-xlsx');
require('dotenv').config();
const request = require('request');
const { setDefaultResultOrder } = require('dns');

const credentials = {
    type: process.env.type,
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: process.env.private_key.replace(/\\n/g, '\n'),
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url
}

app.use(express.json());
app.use(express.static('uploads'));

const uploadpath = path.join(__dirname, 'uploads', '/');

admin.initializeApp({
    credential: admin.credential.cert(credentials),
    storageBucket: process.env.STORAGE_BUCKET
});

const db = admin.firestore();
var batch = db.batch();
const bucket = admin.storage().bucket();

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const multerFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(xls|xlsx)$/)) {
        return cb(new Error('Please upload an excel file'));
    }
    cb(undefined, true)
}

const uploadFile = multer({
    storage: storage,
    fileFilter: multerFilter
})

const uploadSingleImage = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an excel file'));
        }
        cb(undefined, true)
    }
}).single('file');

const uploadMultipleImages = multer({
    storage: storage,
    /*fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an excel file'));
        }
        cb(undefined, true)
    }*/
}).any('file');

/*app.get('/', async (req, res) => {
    if (access_token == 'not generated') {
        request({
            uri: 'https://oauth2.googleapis.com/token',
            method: 'post',
            qs: {
                grant_type: 'authorization_code',
                code: code,
                client_id: client_id,
                client_secret: client_secret,
                redirect_uri: redirect_uri
            }
        }, (error, response) => {
            if (error)
                console.log(error)
            else {
                access_token = JSON.parse(response.body).access_token;
                refresh_token = JSON.parse(response.body).refresh_token;
                console.log(JSON.parse(response.body))
            }
        })
    }
    else {
        request({
            uri: ' https://www.googleapis.com/oauth2/v1/tokeninfo',
            method: 'post',
            qs: {
                access_token: access_token
            }
        }, (error, response) => {
            if (error)
                console.log("Error", error)
            else {
                console.log("response", JSON.parse(response.body))
                let expires_in = JSON.parse(response.body).expires_in;
                if (expires_in <= 100 || JSON.parse(response.body).error == 'invalid_token') {
                    request({
                        uri: 'https://oauth2.googleapis.com/token',
                        method: 'post',
                        qs: {
                            grant_type: 'refresh_token',
                            refresh_token: refresh_token,
                            client_id: client_id,
                            client_secret: client_secret,
                            redirect_uri: redirect_uri
                        }
                    }, (error, response) => {
                        if (error) {
                            console.log(error)
                        }
                        else {
                            access_token = JSON.parse(response.body).access_token;
                            console.log(JSON.parse(response.body))
                        }
                    })
                }
            }

        })
    }
    console.log(access_token)
})
*/

app.get('/',(req,res)=>{
    res.send({message:"Server Deployed"});
})

app.post('/create', async (req, res) => {
    const data = {
        id: req.body.userid,
        email: req.body.email,
        password: req.body.password,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    };
    const response = db.collection("users").doc(req.body.userid).set(data);
    res.send(response)
})

app.get('/read', async (req, res) => {
    /*const result = db.collection("users");
    const response = await result.get();
    let responseArr = [];
    response.forEach(doc => {
        responseArr.push(doc.data())
    })
    res.send(responseArr)*/
    console.log("Read", req.params)
})

app.get('/read/:id', async (req, res) => {
    const result = db.collection("users").doc(req.params.id);
    const response = await result.get();
    res.send(response.data())
})

app.put('/update/:id', async (req, res) => {
    const result = await db.collection("users").doc(req.params.id)
        .update({
            email: req.body.email,
            id: req.body.id,
            password: req.body.password,
            updatedAt: admin.firestore.Timestamp.now()
        })
    res.send(response)
})

app.put('/update/many', async (req, res) => {
    let ids = [];
    ids = req.body.id.split('/');
    for (let i = 0; i < ids.length; i++) {
        const result = await db.collection("users").doc(ids[i])
            .update({
                email: req.body.email,
                id: req.body.id,
                password: req.body.password,
                updatedAt: admin.firestore.Timestamp.now()
            })
    }
    res.send(response)
})

app.delete('/delete/:id', async (req, res) => {
    const response = await db.collection("users").doc(req.params.id).delete();
    res.send(response)
})

app.post('/uploadImage', uploadSingleImage, async (req, res) => {
    const filepath = uploadpath + req.file.filename;
    bucket.upload(filepath, {
        destination: `images/${req.file.filename}`,
        gzip: true,
        metadata: {
            cacheControl: 'public, max-age=31536000'
        }
    }).then(() => {
        // get image url
        const file = bucket.file(`images/${req.file.filename}`)
        const config = {
            action: 'read',
            expires: '03-17-2025',
        };
        file.getSignedUrl(config, (err, url) => {
            if (err)
                res.send(err)
            else
                res.send({ message: "File Uploaded", imageUrl: url })
        })
    }).catch(err => {
        res.send('ERROR:', err);
    });
})

app.post('/uploadImages', uploadMultipleImages, async (req, res) => {
    var imageUrlArray = [];
    let flag = 0;
    req.files.forEach((item) => {
        const filepath = uploadpath + item.filename
        bucket.upload(filepath, {
            destination: `images/${item.filename}`,
            gzip: true,
            metadata: {
                cacheControl: 'public, max-age=31536000'
            }
        }).then(() => {
            flag = 0
        }).catch((err) => {
            flag = 1
            res.send(err)
            return false;
        })
    })
    if (flag == 0) {
        req.files.forEach((item) => {
            const file = bucket.file(`images/${item.filename}`)
            const config = {
                action: 'read',
                expires: '03-17-2025',
            };
            file.getSignedUrl(config, (err, url) => {
                if (err)
                    res.send(err)
                else {
                    imageUrlArray.push(url)
                    if (imageUrlArray.length == req.files.length) {
                        res.send({ status: 200, message: "Images Successfully Uploaded", imageURLs: imageUrlArray })
                    }
                }
            })
        })
    }
})

app.post('/getImage', async (req, res) => {
    const file = bucket.file(`images/${req.body.file}`)
    const config = {
        action: 'read',
        expires: '03-17-2025',
    };
    file.getSignedUrl(config, (err, url) => {
        if (err)
            res.send(err)
        else
            res.send({ imageUrl: url })
    })
})

app.listen(process.env.PORT, () => {
    console.log("Server Running")
})

module.exports = app;