import mongoose from 'mongoose';
import _ from 'lodash';

export default class UniversalSchema {
  static defaultParams = {
    filter: {},
    sort: {},
    limit: 20,
    populate: [],
    prepare: null,
  };
  static defaultOptions = {
    timestamps: true,
  };
  constructor(schema = {}, options = {}) {
    this.schema = schema;
    this.options = Object.assign({}, this.constructor.defaultOptions, options);
    this.statics = {
      findByParams(incomeParams) {
        const params = Object.assign({}, this.constructor.defaultParams, incomeParams);

        const res = this.find(params.filter)
          .sort(params.sort)
          .limit(params.limit);
        if (params.prepare) {
          return this.prepare(res, params.prepare)
        }

        return res;
      },
      async prepareOne(obj) {
        return obj;
      },
      prepare(obj, ...args) {
        if (Array.isArray(obj)) {
          return Promise.map(obj, o => this.prepareOne(o, ...args));
        }
        return this.prepareOne(obj, ...args);
      },
    };
    this.methods = {};
    this.preMethods = {};
    this.postMethods = {};
    this.indexes = [];
    this.virtuals = [];
  }


  extend(schema, options) {
    const object = new UniversalSchema();
    const fields = ['schema', 'options', 'statics', 'methods', 'preMethods', 'postMethods', 'indexes', 'virtuals'];
    fields.forEach((key) => {
      object[key] = _.clone(this[key]);
    });
    Object.assign(object.schema, schema);
    Object.assign(object.options, options);
    return object;
  }

  generateMongooseName(name = 'Model') {
    return `${name}_${Date.now()}`;
  }


  getMongooseSchema() {
    const schema = new mongoose.Schema(this.schema, this.options);
    schema.statics = this.statics;
    schema.methods = this.methods;
    _.forEach(this.preMethods, (val, key) => {
      schema.pre(key, val);
    });
    _.forEach(this.postMethods, (val, key) => {
      schema.post(key, val);
    });
    _.forEach(this.virtuals, ([args1, method, args2]) => {
      // console.log('virtuals', method, args1);
      if (method === 'init') {
        schema.virtual(...args1);
      } else {
        schema.virtual(...args1)[method](...args2);
      }
    });
    _.forEach(this.indexes, (args) => {
      schema.index(...args);
    });
    return schema;
  }

  getMongooseModel(db) {
    if (!db) {
      console.log('ERROR UniversalSchema.getMongooseModel() !db');
      throw 'ERROR UniversalSchema.getMongooseModel() !db';
      return null;
    }
    if (!this.options.collection) {
      throw '!this.options.collection';
    }
    return db.model(this.options.model || this.generateMongooseName(this.options.collection), this.getMongooseSchema(), this.options.collection);
  }

  run({ db } = {}) {
    return this.getMongooseModel(db);
  }

  pre(key, val) {
    this.preMethods[key] = val;
  }

  post(key, val) {
    this.postMethods[key] = val;
  }

  virtual(...args1) {
    if (args1.length > 1) {
      this.virtuals.push([args1, 'init']);
    }
    return {
      set: (...args2) => {
        this.virtuals.push([args1, 'set', args2]);
      },
      get: (...args2) => {
        this.virtuals.push([args1, 'get', args2]);
      },
    };
  }
  index(...args) {
    this.indexes.push(args);
  }

}
