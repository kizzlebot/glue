
'use strict';
// Load modules

const Path = require('path');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Items = require('items');
const Joi = require('joi');


// Declare internals
const internals = module.exports = (params) => {
    return {
        compose(callback){
            return internals.compose(params, callback);
        }
    }
}



internals.schema = {
    params: Joi.object().keys({
        options: Joi.object({
            relativeTo: Joi.string(),
            preConnections: Joi.func().allow(false),
            preRegister: Joi.func().allow(false),
            select: Joi.alternatives().try([
                Joi.array().items(Joi.string()).sparse(false),
                Joi.string()
            ])
        }).default({}),
        manifest: Joi.object({
            server: Joi.object(),
            connections: Joi.array().items(Joi.object()),
            registrations: Joi.array().items(Joi.object({
                plugin: [
                    Joi.string(),
                    Joi.object({ register: Joi.string() }).unknown()
                ],
                options: Joi.object()
            }))
        }).required(),
        server: Joi.object()
    }).requiredKeys(['manifest'])
};


internals.compose = function(parameters, callback){
    return internals.build(parameters, callback);
}

internals.build = function (parameters, callback) {

    Joi.assert(parameters.manifest, Joi.reach(internals.schema.params, 'manifest'), 'Invalid manifest');
    Joi.assert(parameters.options , Joi.reach(internals.schema.params, 'options'), 'Invalid options');

    const isValid = Joi.validate(parameters, internals.schema.params);
    const params = isValid.value;

    // Return Promise if no callback provided

    if (!callback) {
        return new Promise((resolve, reject) => {
            internals.build(params, (err, server) => {
                if (err) {
                    return reject(err);
                }
                return resolve(server);
            });
        });
    }

    // Use/Create server
    const {steps, server} = internals.generateSteps(params, params.options);

    Items.serial(steps, (step, nextstep) => {
        step(nextstep);
    }, (err) => {
        if (err) {
            return Hoek.nextTick(callback)(err);
        }
        Hoek.nextTick(callback)(null, server);
    });
};



internals.parsePlugin = function (plugin, relativeTo) {

    plugin = Hoek.cloneWithShallow(plugin, ['options']);

    if (typeof plugin === 'string') {
        plugin = {
            register: plugin
        };
    }

    let path = plugin.register;

    if (relativeTo && path[0] === '.') {
        path = Path.join(relativeTo, path);
    }

    plugin.register = require(path);
    return plugin;
};

internals.generateSteps = ({server, options, manifest}, glueOpts) => {

    const serverOpts = internals.parseServer(manifest.server || {}, options.relativeTo);

    const registerOnly = (!server) ? false : true;

    server = (!server) ? new Hapi.Server(serverOpts) : server;

    const steps = [];

    if (!registerOnly){

        // if preconnections function defined then call it
        steps.push((next) => {
            return (options.preConnections) ?
            options.preConnections(server, next) : next();
        });

        // Load each connection
        steps.push((next) => {
            // Load connections
            if (manifest.connections && manifest.connections.length > 0) {
                manifest.connections.forEach((connection) => {
                    server.connection(connection);
                });
            }
            else {
                server.connection();
            }
            return next();
        });

        // If preRegister function defined, then execute it before registration happens
        steps.push((next) => {
            if (options.preRegister) {
                return options.preRegister(server, next);
            }
            return next();
        });
    }

    steps.push((next) => {
        // load registrations
        if (manifest.registrations) {
            const registrations = manifest.registrations.map((reg) => {

                reg.options = Hoek.reach(reg, 'options', {default: {}});
                const select = Hoek.reach(glueOpts, 'select', {default: undefined});

                reg.options = !select ? reg.options : Hoek.applyToDefaults(reg.options, { select: select });
                const plugin = internals.parsePlugin(reg.plugin, options.relativeTo);

                return {
                    plugin: plugin,
                    options: reg.options
                };
            });

            return Items.serial(registrations, (reg, nextregister) => {
                server.register(reg.plugin, reg.options, nextregister);
            }, next);
        }
        else {
            next();
        }
    });

    return {steps, server};
}


internals.parseServer = function (server, relativeTo) {

    if (server.cache) {
        server = Hoek.clone(server);

        const caches = [];
        const config = [].concat(server.cache);

        for (let i = 0; i < config.length; ++i) {
            let item = config[i];
            if (typeof item === 'string') {
                item = { engine: item };
            }

            if (typeof item.engine === 'string') {
                let strategy = item.engine;
                if (relativeTo && strategy[0] === '.') {
                    strategy = Path.join(relativeTo, strategy);
                }

                item.engine = require(strategy);
            }

            caches.push(item);
        }
        server.cache = caches;
    }
    return server;
};

