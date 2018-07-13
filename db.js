const MongoClient = require("mongodb").MongoClient;

const connectDataBase = async function() {
    const url = "mongodb://localhost:27017";
    const mongo = await MongoClient.connect(url,{useNewUrlParser: true});
    const db = mongo.db("temp");
    return { mongo: mongo, db: db };
};

module.exports = connectDataBase;
