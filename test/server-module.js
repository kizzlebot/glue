'use strict';

const Code = require('code');

const Lab = require('lab');
const Hoek = require('hoek');
const Hapi = require('hapi');

// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const Machete = require('..');

// Declare internals

const internals = {};


describe('machete module', () => {
    it('should exist and it should be a function', (done) => {
        expect(Machete).to.exist();
        expect(Machete).to.be.a.function();
        done();
    });

    it('should accept a manifest, options, and server param arg and return a partial function', (done) => {
        const manifest = {};
        const rtn = Machete({manifest, options: {}}, {
            name: 'some server module',
            version: '0.0.1'
        });

        expect(rtn).to.be.an.object();
        expect(rtn.register).to.be.a.function();
        expect(rtn.register.attributes).to.be.an.object();
        done();
    });

    it('should return a register function that takes three args and compose', (done) => {
        const manifest = {};

        const rtn = Machete({manifest, options: {}}, {
            name: 'some server module',
            version: '0.0.1'
        });

        expect(rtn).to.be.an.object();
        expect(rtn.register).to.be.a.function();
        expect(rtn.register.length).to.equal(3);

        expect(rtn.compose).to.be.a.function();
        expect(rtn.compose.length).to.equal(1);

        done();
    });

    it('should return a register function that composes the server using server instance', (done) => {
        const server = new Hapi.Server();
        const manifest = {
            registrations: [ {
                plugin: './plugins/route.js',
                options: {
                    routes: { prefix: '/b/' }
                }
            }]
        };

        const param = {
            server: server,
            manifest: manifest,
            options:{
                relativeTo: `${__dirname}`,
                select: ['api']
            }
        }

        server.connection({ port: 8000, labels: 'api' });

        server.app.key = 'abcdefg';

        const rtn = Machete(param, {
            name: 'some server module',
            version: '0.0.1'
        });

        expect(rtn).to.be.an.object();
        expect(rtn.register).to.be.a.function();
        // expect(rtn.attributes).to.be.an.object();
        expect(rtn.register.attributes).to.include(['name', 'version']);
        expect(rtn.register.length).to.equal(3);
        expect(Object.keys(server.plugins).length).to.equal(0);

        rtn.register(server, {}, (err, sserver) => {
            expect(err).to.not.exist();
            expect(sserver).to.exist();
            expect(sserver.app.key).to.equal(server.app.key);

            server.select('api').inject('/b/plugin', (responseA) => {
                expect(responseA).to.exist();
                done();
            });
        })
    });

    it('should return a compose function that composes the server using server instance', (done) => {
        const manifest = {};

        const server = new Hapi.Server();
        server.connection({port: 8080});
        server.app.key = 'abcdefg';

        const rtn = Machete({manifest, options: {}, server}, {
            name: 'some server module',
            version: '0.0.1'
        });

        expect(rtn).to.be.an.object();
        expect(rtn.register).to.be.a.function();
        expect(rtn.register.length).to.equal(3);

        rtn.compose((err, sserver) => {
            expect(err).to.not.exist();
            expect(sserver).to.exist();
            expect(sserver.app.key).to.equal(server.app.key);
            done();
        })
    });


})