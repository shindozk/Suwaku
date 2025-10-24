/**
 * Test file to verify CommonJS imports work correctly
 */

// Test CommonJS import
const { SuwakuClient, FilterPresets } = require('../src/index');

console.log('✅ CommonJS import successful');
console.log('SuwakuClient:', typeof SuwakuClient);
console.log('FilterPresets:', typeof FilterPresets);

// Test that classes are constructable
try {
    const mockClient = {
        isReady: () => false,
        on: () => {},
        once: () => {},
        user: { id: '123' },
        guilds: { cache: new Map() }
    };

    const suwaku = new SuwakuClient(mockClient, {
        nodes: [{
            host: 'localhost',
            port: 2333,
            password: 'test'
        }]
    });

    console.log('✅ SuwakuClient instantiation successful');
    console.log('Version:', suwaku.version);
} catch (error) {
    console.error('❌ Error instantiating SuwakuClient:', error.message);
}

// Test FilterPresets
console.log('Available filter presets:', Object.keys(FilterPresets).length);
console.log('✅ All imports working correctly!');
