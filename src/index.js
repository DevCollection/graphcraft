const assert = require('assert');
const cls = require('cls-hooked');
const TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';
const sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);
const { createContext, resetCache } = require('dataloader-sequelize')

// library options
const defaultOptions = {

  /**
   * naming convention for mutations/queries and types.
   * {name} = Model Name or type name
   * {type} = Get | Create | Update | Delete
   * {bulk} = Bulk for bulk operations only
   * */

  naming: {
    pascalCase: true, // applied everywhere
    queries: '{name}', // applied to auto generated queries
    mutations: '{name}{type}{bulk}', // applied to auto generated mutations
    input: '{name}', // applied to all input types
    rootQueries: 'RootQueries',
    rootMutations: 'RootMutations'
  },
  exclude: [], // exclude these models from graphql
  includeArguments: {}, // include these arguments to all queries/mutations
  remote: {},
  dataloader: false,
  transactionedMutations: true,
  privateMode: false,
  types: {}, // custom graphql types
  // executes after all queries/mutations
  logger() {
    return Promise.resolve();
  },
  // executes before all queries/mutations
  authorizer() {
    return Promise.resolve();
  },
  // executes when exceptions are thrown
  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};
// Model options model.graphql
const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
    include: {}, // attributes in key:type format which are to be included in Model Input
    import: []
  },
  scopes: null, // common scope to be applied on all find/update/destroy operations
  alias: {}, // rename default queries/mutations to specified custom name
  bulk: { // OR bulk: ['create', 'destroy', ....]
    enabled: [], // enable bulk options ['create', 'destroy', 'update']
    // Use bulkColumn when using bulk option for 'create' when using returning true and to increase efficiency.
    bulkColumn: false, // bulk identifier column, when bulk creating this column will be auto filled with a uuid and later used to fetch added records 'columnName' or ['columnName', true] when using a foreign key as bulk column
    returning: true // This will return all created/updated items, doesn't use sequelize returning option.
  },
  mutations: {}, // user defined custom mutations
  queries: {}, // user defined custom queries
  excludeMutations: [], // exclude one or more default mutations ['create', 'destroy', 'update']
  excludeQueries: [], // exclude one or more default queries ['fetch']
  extend: {}, // extend/after hook default queries/mutations behavior {fetch, create, destroy, update}
  before: {}, // before hook for default queries/mutations behavior {fetch, create, destroy, update}
  overwrite: {} // overwrite default queries/mutations behavior {fetch, create, destroy, update}
};

const options = {};
const GenerateQueries = require('./libs/generateQueries');
const GenerateMutations = require('./libs/generateMutations');
const GenerateTypes = require('./libs/generateTypes');
let dataloaderContext;

/*const errorHandler = (error) => {
  for (const name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};*/

function generateSchema(models, context) {

  assert(models.Sequelize, 'Sequelize not found as models.Sequelize.');
  assert(models.sequelize, 'sequelize instance not found as models.sequelize.');

  options.Sequelize = models.Sequelize;
  options.sequelize = models.sequelize;

  options.Sequelize.useCLS(sequelizeNamespace);

  if (options.dataloader) {
    dataloaderContext = createContext(models.sequelize);
    options.dataloaderContext = dataloaderContext;
  }

  const { generateModelTypes } = GenerateTypes(options);
  const generateQueries = GenerateQueries(options);
  const generateMutations = GenerateMutations(options);
  const modelsIncluded = {};

  for (const modelName in models) {

    const model = models[modelName];

    if ('name' in model && modelName !== 'Sequelize' && !options.exclude.includes(modelName)) {
      model.graphql = model.graphql || defaultModelGraphqlOptions;
      model.graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, model.graphql.attributes);
      model.graphql = Object.assign({}, defaultModelGraphqlOptions, model.graphql);
      modelsIncluded[modelName] = model;
    }

  }

  const modelTypes = generateModelTypes(modelsIncluded, options.types || {});

  return {
    query: generateQueries(modelsIncluded, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: generateMutations(modelsIncluded, modelTypes.outputTypes, modelTypes.inputTypes)
  };

}

module.exports = (_options) => {
  Object.assign(options, defaultOptions, _options);

  return {
    generateSchema,
    resetCache,
    dataloaderContext
  };
};