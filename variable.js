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

module.exports = variable;