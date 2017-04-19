
const skygearCloud = require('skygear/cloud');

/**
 * Database query helper, returns promise of result.
 */
function query(stmt, data = []) {
  return new Promise((resolve, reject) => {
    skygearCloud.poolConnect((err, client, done) => {
      if(err) reject(err);
      client.query(stmt, data, (err, result) => {
        done(err);  
        if(err) reject(err);
        else    resolve(result);
      });
    });
  });
}

/**
 * Lambda registeration helper.
 *
 * Handlers are called with a single obj with the keys "req" and "opt" from skygear
 * and additional optional keys provided by the "inject" option.
 *
 * Role-based access control is supported via the "roleRequired" option,
 * expects the role name (string).
 *
 */
function lambda(endpoint, options, handler) {
  const {
    inject = {},
    roleRequired,
  } = options;
  skygearCloud.op(
    endpoint,
    (req, opt) => {
      return Promise.resolve()
        .then(_ => {
          if(roleRequired && req.api_key !== skygearCloud.settings.masterKey) {
            return query(
              'SELECT 1 FROM _user_role WHERE user_id = $1 AND role_id = $2',
              [opt.context && opt.context.user_id, roleRequired]
            );
          }
        })
        .then(result => {
          if(result && result.rows.length < 1) {
            throw `Error: endpoint ${endpoint} requires role ${roleRequired}`;
          }
        })
        .then(_ => {
          return handler(Object.assign(inject, {req, opt}));
        });
    },
    options
  );
}

module.exports = {query, lambda};

