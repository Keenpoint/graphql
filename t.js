// const {normSchema,normResolver} = require("./norme.js")
// const dd = require(__dirname + "/default-engine/engine.js");
// const run = require("./server.js");
// const fetch = require("node-fetch")
//
//     const variable = {
//         entities: [
//             {
//                 name: "Job",
//                 type: "normal",
//                 fields: [
//                     { path: "_id", type: "ID", required: true },
//                     { path: "title", type: "String" },
//                     { path: "description", type: "String" },
//                     { path: "company", type: "Company", link: "OTO" }
//                 ]
//             },
//             {
//                 name: "Company",
//                 type: "normal",
//                 fields: [
//                     { path: "_id", type: "ID", required: true },
//                     { path: "name", type: "String" },
//                     { path: "description", type: "String" },
//                     {
//                         path: "jobs",
//                         type: "Job",
//                         link: "OTM",
//                         ref: "company"
//                     }
//                 ]
//             },
//             {
//                 name: "InputCompany",
//                 type: "input",
//                 fields:[
//                     { path: "name", type: "String"},
//                     { path: "description", type: "String"}
//                 ]
//             },
//             {
//                 name: "Query",
//                 type: "query",
//                 fields: [
//                     { path: "jobs", type: "Job", isArray: true },
//                     {
//                         path: "job",
//                         type: "Job",
//                         input: [
//                             { path: "_id", type: "ID", required: true },
//                             { path: "title", type: "String" }
//                         ]
//                     },
//                     {
//                         path: "company",
//                         type: "Company",
//                         input: [
//                             { path: "_id", type: "ID" },
//                             { path: "name", type: "String" }
//                         ]
//                     }
//                 ]
//             },
//             {
//                 name: "Mutation",
//                 type: "mutation",
//                 fields: [
//                     {
//                         path:"deleteCompany",
//                         type: "Company",
//                         operation: "delete",
//                         isArray: true,
//                         input:[
//                             { path: "_id", type: "ID", required: true}
//                         ]
//                     },
//                     {
//                         path: "createCompany",
//                         type: "Company",
//                         operation: "create",
//                         isArray: true,
//                         input:[
//                             { path: "inputCompany", type: "InputCompany", required: true}
//                         ]
//                     },
//                     {
//                         path: "updateCompany",
//                         type: "Company",
//                         operation: "update",
//                         isArray: true,
//                         input:[
//                             { path: "inputCompany", type: "InputCompany", required: true},
//                             { path: "_id", type: "ID", required:true}
//                         ]
//                     },
//                 ]
//             }
//         ]
//     };
//
//     const schema = dd.normalize(variable.entities,normSchema);
//     const jobResolver = dd.normalize(variable.entities[0], normResolver);
//     const companyResolver = dd.normalize(variable.entities[1], normResolver);
//     const queryResolver = dd.normalize(variable.entities[3], normResolver);
//     const mutationResolver = dd.normalize(variable.entities[4], normResolver);
//
//     const resolvers = {
//         Query: queryResolver.rf,
//         Mutation: mutationResolver.rf,
//         Job: jobResolver.srf,
//         Company: companyResolver.srf
//     };
//
//     async function r(){
//         await run(schema,resolvers);
//         const data = await fetch('http://localhost:5000/graphql?query={jobs{_id}}')
//             .then(function(res) {
//                 return res.json();
//             })
//         console.log(data)
//     }
//     r();
const value  =20;
const f = function(){
    console.log(value);
}

const b = function(){
    const value = 10;
    f()
}
b()