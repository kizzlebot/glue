'use strict';

const Hoek = require('hoek');
const Machete = require('./lib');

const internals = module.exports = (params, attrs) => {
    return internals.register(params, attrs);
};

// builds an object that can be exported
internals.register = (params, attrs) => {
    const register = (server, options, next) => {
        const params = Hoek.merge({}, params, {
            server: server
        });

        if (options.select){
            params.options = Hoek.merge({}, params.options, {select: options.select});
        }

        return Machete(params).compose(next);
    };
    register.attributes = attrs;

    return {
        compose: (callback) => Machete(params).compose(callback),
        register: register
    }
};


internals.register.attributes = {
    pkg: {
        name: 'machete',
        version: '0.0.1'
    }
}