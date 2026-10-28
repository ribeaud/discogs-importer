'use strict';

const assert = require('assert');
const {importOrders} = require('../app');
const item = title => ({Artist: 'Artist', Title: title, Format: 'Vinyl'});
const candidate = id => ({id, title: `Artist - ${id}`, type: 'release', format: ['Vinyl']});

function environment(dryRun = true) {
    const stored = [];
    return {
        stored,
        config: {userName: 'test', folderName: 'Deejay', dryRun},
        logger: {info() {}, error() {}}, wait: async () => {},
        database: {search: async () => ({results: [candidate(7)]})},
        collection: {
            getFolders: async () => ({folders: [{id: 2, name: 'Deejay'}]}),
            getReleaseInstances: async () => ({releases: stored}),
            addRelease: async (user, folder, id) => { stored.push({user, folder, id}); }
        }
    };
}

describe('Import workflow', () => {
    it('defaults safely to a dry run and deduplicates planned releases', async () => {
        const env = environment();
        delete env.config.dryRun;
        const result = await importOrders([item('A'), item('A')], env);
        assert.strictEqual(result.planned, 1);
        assert.strictEqual(result.existing, 1);
        assert.deepStrictEqual(env.stored, []);
    });
    it('continues after a failed search and adds a later release only once', async () => {
        const env = environment(false);
        env.database.search = async (query, params) => {
            if (params.title === 'Broken') throw new Error('Network failure');
            return {results: [candidate(7)]};
        };
        const result = await importOrders([item('Broken'), item('Good'), item('Good')], env);
        assert.deepStrictEqual(result, {added: 1, planned: 0, existing: 1, review: 0, unmatched: 0, failed: 1});
        assert.deepStrictEqual(env.stored, [{user: 'test', folder: 2, id: 7}]);
    });
    it('does not mistake a single first-page result for an unambiguous match', async () => {
        const env = environment(false);
        env.database.search = async (query, params) => ({results: [candidate(params.page)], pagination: {pages: 2}});
        const result = await importOrders([item('A')], env);
        assert.strictEqual(result.review, 1);
        assert.deepStrictEqual(env.stored, []);
    });
    it('rejects a missing destination instead of writing to another folder', async () => {
        const env = environment(false);
        env.config.folderName = 'Missing';
        await assert.rejects(importOrders([item('A')], env), /Collection folder not found/);
        assert.deepStrictEqual(env.stored, []);
    });
    it('routes tied fallback pressings to review without adding either', async () => {
        const env = environment(false);
        env.database.search = async query => ({results: query ?
            [7, 8].map(id => ({...candidate(id), title: 'Artist - A'})) : []});
        const result = await importOrders([item('A')], env);
        assert.strictEqual(result.review, 1);
        assert.deepStrictEqual(env.stored, []);
    });
    for (const visible of [false, true]) {
        it(`does not repeat an uncertain write when collection visibility is ${visible}`, async () => {
            const env = environment(false);
            env.database.search = async (query, params) => ({results: [candidate(params.title === 'B' ? 8 : 7)]});
            env.collection.getReleaseInstances = async (user, id) => ({
                releases: visible ? env.stored.filter(release => release.id === id) : []
            });
            env.collection.addRelease = async (user, folder, id) => {
                env.stored.push({user, folder, id});
                if (id === 7) throw new Error('Response timed out; server outcome unknown');
            };
            const result = await importOrders([item('A'), item('A'), item('B')], env);
            assert.deepStrictEqual(env.stored, [
                {user: 'test', folder: 2, id: 7}, {user: 'test', folder: 2, id: 8}
            ]);
            assert.deepStrictEqual(result, {added: 1, planned: 0, existing: 0, review: 1, unmatched: 0, failed: 1});
        });
    }
    it('handles an empty export without accessing the API', async () => {
        const result = await importOrders([], {config: {}});
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(result.added, 0);
    });
});
