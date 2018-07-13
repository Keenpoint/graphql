const {normSchema,normResolver} = require("./norme.js")
const dd = require(__dirname + "/default-engine/engine.js");
const {run,app,connectDataBase} = require("./server.js");
const axios = require("axios");
const ObjectID = require("mongodb").ObjectID;


const insertMany = collection => async(objects) =>{
    const mongo = await connectDataBase()
    await mongo.db.collection(collection.toString()).insertMany(objects)
}

const generate = collection => async(...objects) =>{
    const enhancedObjects = objects.map(
        object => ({ _id: new ObjectID(), ...object })
    )
    await insertMany(collection)(enhancedObjects)
    return enhancedObjects;
}

function createRef(object) {
    return new ObjectID(object[0]._id)
}

const clearDb = async() =>{
    const mongo = await connectDataBase();

    const collections = await mongo.db.listCollections().toArray();

    for(let i of collections){
        await mongo.db.collection(i.name).removeMany()
    }


    // mongo.db.getCollectionNames().forEach( function(collection_name) {
    //     if (collection_name.indexOf("system.") === -1)
    //         mongo.db[collection_name].drop();
    //     else
    //         mongo.db.collection_name.remove({});
    // });
    // console.log(await mongo.db.listCollections().toArray())
}

describe("test graphql", () =>{

    const variable = {
        entities: [
            {
                name: "Job",
                type: "normal",
                fields: [
                    { path: "_id", type: "ID", required: true },
                    { path: "title", type: "String" },
                    { path: "description", type: "String" },
                    { path: "company", type: "Company", link: "OTO" }
                ]
            },
            {
                name: "Company",
                type: "normal",
                fields: [
                    { path: "_id", type: "ID", required: true },
                    { path: "name", type: "String" },
                    { path: "description", type: "String" },
                    {
                        path: "jobs",
                        type: "Job",
                        link: "OTM",
                        ref: "company"
                    }
                ]
            },
            {
                name: "InputCompany",
                type: "input",
                fields:[
                    { path: "name", type: "String"},
                    { path: "description", type: "String"}
                ]
            },
            {
                name: "Query",
                type: "query",
                fields: [
                    { path: "jobs", type: "Job", isArray: true },
                    {
                        path: "job",
                        type: "Job",
                        input: [
                            { path: "_id", type: "ID", required: true },
                            { path: "title", type: "String" }
                        ]
                    },
                    {
                        path: "company",
                        type: "Company",
                        input: [
                            { path: "_id", type: "ID" },
                            { path: "name", type: "String" }
                        ]
                    },
                    { path: "companies", type: "Company", isArray: true }
                ]
            },
            {
                name: "Mutation",
                type: "mutation",
                fields: [
                    {
                        path:"deleteCompany",
                        type: "Company",
                        operation: "delete",
                        isArray: true,
                        input:[
                            { path: "_id", type: "ID", required: true}
                        ]
                    },
                    {
                        path: "createCompany",
                        type: "Company",
                        operation: "create",
                        isArray: true,
                        input:[
                            { path: "inputCompany", type: "InputCompany", required: true}
                        ]
                    },
                    {
                        path: "updateCompany",
                        type: "Company",
                        operation: "update",
                        isArray: true,
                        input:[
                            { path: "inputCompany", type: "InputCompany", required: true},
                            { path: "_id", type: "ID", required:true}
                        ]
                    },
                ]
            }
        ]
    };

    const schema = dd.normalize(variable.entities,normSchema);
    const jobResolver = dd.normalize(variable.entities[0], normResolver);
    const companyResolver = dd.normalize(variable.entities[1], normResolver);
    const queryResolver = dd.normalize(variable.entities[3], normResolver);
    const mutationResolver = dd.normalize(variable.entities[4], normResolver);

    const resolvers = {
        Query: queryResolver.rf,
        Mutation: mutationResolver.rf,
        Job: jobResolver.srf,
        Company: companyResolver.srf
    };

    const port = 3000;



    beforeEach(clearDb)

    it("schema form", () => {

        const string ="type Job {_id:ID!,title:String,description:String,company:Company,}\n" +
            "type Company {_id:ID!,name:String,description:String,jobs:[Job],}\n" +
            "input InputCompany {name:String,description:String,}\n" +
            "type Query {jobs:[Job],job(_id: ID! title: String ):Job,company(_id: ID name: String ):Company,companies:[Company],}\n" +
            "type Mutation {deleteCompany(_id: ID! ):[Company],createCompany(inputCompany: InputCompany! ):[Company],updateCompany(inputCompany: InputCompany! _id: ID! ):[Company],}\n" +
            ""
        expect(schema).toEqual(string)
    })

    it("running server",async () =>{
        await run(schema,resolvers);
    })

    it("query jobs", async() => {

        const company = await generate("Company")(
            {
                "name" : "keenpoint1",
                "description" : " network Enterprise"
            })

        const data1 =
            {
                "company": createRef(company),
                "title": "Frontend Developer",
                "description": "We are looking for a Frontend Developer familiar with React."
            };

        const data2 =
            {
                "company": createRef(company),
                "title": "Backend Developer",
                "description": "We are looking for a Backend Developer familiar with Node.js and Express."
            }


        await generate("Job")(data1);
        await generate("Job")(data2);

        const response = await axios.post(`http://localhost:${port}/graphql`,{
            query:`
            query {
              jobs{
                title
                description
                company{
                    name
                    description
                }
              }
            }
            `
        })
        const {data} = response
        expect(data).toMatchObject({
            "data": {
                "jobs": [
                    {
                        "title": "Frontend Developer",
                        "company": {
                            "name": "keenpoint1",
                            "description": " network Enterprise"
                        },
                        "description": "We are looking for a Frontend Developer familiar with React.",
                    },
                    {
                        "title": "Backend Developer",
                        "company": {
                            "name": "keenpoint1",
                            "description": " network Enterprise"
                        },
                        "description": "We are looking for a Backend Developer familiar with Node.js and Express."
                    }
                ]
            }
        })
    })

    it('create company', async () => {

        await generate("Company")(
            {
                "name" : "keenpoint1",
                "description" : " network Enterprise"
            })

        const response = await axios.post(`http://localhost:${port}/graphql`, {
            query: `
              mutation{
                createCompany(inputCompany:{name:"Keenpoint2", description:"network company"}){
                    name
                }
              }
      `,
        });

        const { data } = response;
        expect(data).toMatchObject({
            "data": {
                "createCompany": [
                    {
                        "name": "keenpoint1"
                    },
                    {
                        "name": "Keenpoint2"
                    }
                ]
            }
        })

    });

    it("delete a company",async () =>{

        const company1 = await generate("Company")(
            {
                "name" : "keenpoint1",
                "description" : " network Enterprise"
            })

        const company2 = await generate("Company")(
            {
                "name" : "keenpoint2",
                "description" : " network Enterprise"
            })

        await generate("Job")({
            "company": createRef(company1),
            "title": "Frontend Developer",
            "description": "We are looking for a Frontend Developer familiar with React."
        })

        const id = company2[0]._id
        const response = await axios.post(`http://localhost:${port}/graphql`,{

            query:`
            mutation{
              deleteCompany(_id:"${id.toString()}"){
                _id
                name
                description
                jobs{
                    title
                    description
                }
              }
            }
            `
        })
        const {data} = response
        expect(data).toMatchObject({
            "data": {
                "deleteCompany": [
                    {
                        "_id": company1[0]._id.toString(),
                        "name":"keenpoint1",
                        "description": " network Enterprise",
                        "jobs":[{
                            "title": "Frontend Developer",
                            "description": "We are looking for a Frontend Developer familiar with React."
                        }]
                    }
                ]
            }
        })

    })

    it("update a record", async () =>{

        const company1 = await generate("Company")(
            {
                "name" : "keenpoint1",
                "description" : " network Enterprise"
            })

        const company2 = await generate("Company")(
            {
                "name" : "keenpoint2",
                "description" : " network Enterprise"
            })

        const id = company2[0]._id

        const name = "supreme engineer"


        const response = await axios.post(`http://localhost:${port}/graphql`,{
            query:`
            mutation{
              updateCompany(_id:"${id}",inputCompany:{name:"${name}"}){
                _id
                name
              }
            }
            `
        })

        const {data} = response
        expect(data).toMatchObject({
            "data": {
                "updateCompany": [
                    {
                        "_id": company1[0]._id.toString(),
                        "name": "keenpoint1"
                    },
                    {
                        "_id": company2[0]._id.toString(),
                        "name": "supreme engineer"
                    }
                ]
            }
        })

    })

    it("self-resolver function test", async () =>{
        const company = await generate("Company")(
            {
                "name" : "keenpoint1",
                "description" : " network Enterprise"
            })

        const data1 =
            {
                "company": createRef(company),
                "title": "Frontend Developer",
                "description": "We are looking for a Frontend Developer familiar with React."
            };

        const job1= await generate("Job")(data1)

        const response = await axios.post(`http://localhost:${port}/graphql`,{
            query:`
            query {
              jobs{
                _id
                company{
                    _id
                    jobs{
                      _id
                      company{
                        _id
                      }
                    }
                }
              }
            }
            `
        })
        const {data} = response

        expect(data).toMatchObject({
            "data":{
                "jobs":[
                    {
                        "_id": job1[0]._id.toString(),
                        "company": {
                            "_id": company[0]._id.toString(),
                            "jobs": [
                                {
                                    "_id": job1[0]._id.toString(),
                                    "company": {
                                        "_id": company[0]._id.toString()
                                    }
                                }
                            ]
                        }

                    }
                ]
            }
        })
    })

})