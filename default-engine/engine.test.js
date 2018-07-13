const dd = require('./engine')
const _ = require('lodash')

describe('engine v1', () => {
    describe('Norm integration tests', () => {
        const isString = {
            $v: function isString(value) {
                if(!_.isString(value))
                    throw new Error(`the field "${this.norm.path}" of norm "${this.norm.parentNorm.name}" should be a string`)
            }
        }

        it('should normalize complex object', () => {
            const originalHorse = {
                name: 'Pocoto',
                riders: [
                    {firstName: 'John', lastName: 'Lennon'},
                    {firstName: 'Bob', lastName: 'Dylan'}
                ]
            }

            const horseNorm = {
                name: "Horse",
                fields: [
                    {path: 'name', $p: [isString]},
                    {path: 'age', default: 3},
                    {path: 'riders', fields: [
                        {path: 'firstName', $p: [isString]},
                        {path: 'lastName', $p: [isString]},
                        {path: 'coolName', $default: function(rider, riders, horse) {
                            return `${rider.firstName} ${rider.lastName} rider of ${horse.name}`
                        }},
                    ]}
                ]
            }

            const normalizedHorse = dd.normalize(originalHorse, horseNorm)

            expect(normalizedHorse).toEqual({
                name: 'Pocoto',
                age: 3,
                riders: [
                    {firstName: 'John', lastName: 'Lennon', coolName: 'John Lennon rider of Pocoto'},
                    {firstName: 'Bob', lastName: 'Dylan', coolName: 'Bob Dylan rider of Pocoto'}
                ]
            })
        })
    })

    describe('Norm', () => {
        it('should apply default on undefined type', () => {
            const norm = {
                default: 'Pocoto'
            }

            const toNormalize = [undefined]
            toNormalize.forEach(
                thing => expect(dd.normalize(thing, norm)).toEqual('Pocoto')
            )

            const notToNormalize = [null, 0, 1, '', 'a', {}, [], [undefined], () => {}, function() {}]
            notToNormalize.forEach(
                thing => expect(dd.normalize(thing, norm)).toEqual(thing)
            )
        })

        it('should default value, array and object', () => {
            const origins = [null, 0, 1, '', 'a', {}, [], [undefined]]
            origins.forEach(
                thing => expect(dd.normalize(undefined, {
                    default: thing
                })).toEqual(thing)
            )
        })

        it('should default function', () => {
            const origins = [null, 0, 1, '', 'a', {}, [], [undefined]]
            origins.forEach(
                thing => expect(dd.normalize(undefined, {
                    default: thing
                })).toEqual(thing)
            )

            const f = function() {}

            expect(
                dd.normalize(undefined, {
                    default: f
                })
            ).toEqual(f)
        })

        it('should evaluate $default function', () => {
            const norm = {
                $default: () => 'Pocoto'
            }

            expect(
                dd.normalize(undefined, norm)
            ).toEqual('Pocoto')
        })

        it('should not set if invalid $default string relative location', () => {
            const norm = {
                $default: '../name'
            }

            expect(
                dd.normalize(undefined, norm)
            ).toEqual(undefined)
        })
    })

    describe('Norm fields recursion', () => {
        it('should default on object path', () => {
            const norm = {
                fields: [
                    {path: 'name', default: 'Pocoto'}
                ]
            }
            const input = {}

            expect(
                dd.normalize(input, norm)
            ).toEqual(
                {name: 'Pocoto'}
            )
        })

        it('should normalize array', () => {
            const norm = {
                fields: [
                    {path: 'name', default: 'Pocoto'}
                ]
            }
            const input = [{}, {}]

            expect(
                dd.normalize(input, norm)
            ).toEqual([
                {name: 'Pocoto'},
                {name: 'Pocoto'}
            ])
        })

        it('should ignore fields on undefined or null parents', () => {
            const norm = {
                fields: [
                    {path: 'name', default: 'Pocoto'}
                ]
            }

            expect(
                dd.normalize(null, norm)
            ).toEqual(null)

            expect(
                dd.normalize(undefined, norm)
            ).toEqual(undefined)
        })

        it('should implement $default as relative path to field', () => {
            const norm = {
                fields: [
                    {path: 'nameBis', $default: 'name'},
                    {path: 'child', fields: [
                        {path: 'name', $default: '../name'}
                    ]}
                ]
            }

            const input = {
                name: 'Pocoto',
                child: {}
            }

            expect(
                dd.normalize(input, norm)
            ).toEqual({
                name: 'Pocoto',
                nameBis: 'Pocoto',
                child: {
                    name: 'Pocoto'
                }
            })
        })
    })

    describe('options', () => {
        it('should pass default options to processes', () => {
            let that = null

            const process = jest.fn(function () {
                that = this
            })

            const norm = {
                $p: {$f: process}
            }

            dd.normalize('a', norm)

            expect(process).toHaveBeenCalledTimes(1)
            expect(that.options).toEqual({
                default: true,
                $p: true,
                $v: true,
                $u: true,
                $f: true,
                verbose: false,
                forceEdit: false,
                noCycle: new WeakMap()
            })
        })

        it('should merge custom and default options', () => {
            let that = null

            const process = jest.fn(function () {
                that = this
            })

            const norm = {
                $p: {$f: process}
            }

            const context = {}

            dd.normalize('a', norm, {
                $v: false,
                context
            })

            expect(process).toHaveBeenCalledTimes(1)
            expect(that.options).toEqual({
                default: true,
                $p: true,
                $v: false,
                $u: true,
                $f: true,
                verbose: false,
                forceEdit: false,
                noCycle: new WeakMap(),
                context: {}
            })

            expect(that.options.context).toBe(context)
        })

        it('should use field path to cut normalization', () => {

            const norm = {
                fields: [
                    {path: 'a', default: 'a'},
                    {path: 'b', default: 'b'},
                    {path: 'child', fields: [
                        {path: 'a', default: 'a'},
                        {path: 'b', default: 'b'}
                    ]}
                ]
            }

            const input = { child: {} }

            const fieldPath = ['a', 'child.b']

            dd.normalize(input, norm, {fieldPath})

            expect(dd.normalize(input, norm, {fieldPath})).toEqual({
                a: 'a',
                child: {
                    b: 'b'
                }
            })
        })

        it('no cycle', () => {
            let n = 1

            const norm = {fields: [
                {path: 'children', fields: [
                    {path: 'a', $default: () => n++}
                ]}
            ]}

            const child = {}

            expect(dd.normalize({
                children: [child, child, child]
            }, norm)).toEqual({
                children: [{a: 1}, {a: 1}, {a: 1}]
            })
        })
    })

    describe('processes', () => {
        it('displays proper validation messages', () => {
            expect(
                () => dd.normalize(
                    {},
                    {
                        name: 'Parent',
                        fields: [
                            {name: 'Friend', path: 'friend', $p: 'required'}
                        ]
                    }
                )
            ).toThrowError('Le champ Friend est requis dans l\'instance  de l\'objet Parent')

            expect(
                () => dd.normalize(
                    {child: {}},
                    {
                        name: 'Parent',
                        fields: [
                            {name: 'Child', path: 'child', fields: [
                                {path: 'a', $p: 'required'}
                            ]}
                        ]
                    }
                )
            ).toThrowError('Le champ a est requis dans l\'instance  de l\'objet Child')

            expect(
                () => dd.normalize(
                    {children: [{a: 'a'}, {a: 'a'}, {}]},
                    {
                        name: 'Parent',
                        fields: [
                            {name: 'Child', path: 'children', fields: [
                                {path: 'a', $p: 'required'}
                            ]}
                        ]
                    }
                )
            ).toThrowError('Le champ a est requis dans l\'instance  de l\'objet Child')

            expect(
                dd.normalize(
                    {children: {a: 'a'}},
                    {
                        name: 'Parent',
                        fields: [
                            {name: "Child", path: 'children', fields: [
                                    {name: "a",path: 'a', $p: ['required',{$u: () => "123"}]}
                                ]}
                        ]
                    }
                )
            ).toEqual({children: {a: '123'}})

        })

        it('async on norm', async () => {
            const norm = {$p: [
                {$$u: callback => setTimeout(() => callback(null, 3), 10)},
                {$$u: (value, callback) => setImmediate(() => callback(null, value + 1))}
            ]}
            await expect(
                dd.normalizeAsync(1, norm)
            ).resolves.toEqual(4)
        })

        it('async fields', async () => {
            const norm = {fields: [
                {path: 'a', $p: [
                    {$$u: callback => setTimeout(() => callback(null, 3), 10)}
                ]},
                {path: 'b', $p: [
                    {$$u: (b, parent, callback) => setImmediate(() => callback(null, parent.a + 1))}
                ]},
            ]}

            await expect(
                dd.normalizeAsync({a: 1, b: 1}, norm)
            ).resolves.toEqual({
                a: 3,
                b: 4
            })
        })

        it('sync after async fields', async () => {
            const norm = {fields: [
                {path: 'a', $p: [
                    {$$u: callback => setTimeout(() => callback(null, 3), 10)}
                ]},
                {path: 'b', $default: parent => parent.a + 1},
            ]}

            await expect(
                dd.normalizeAsync({a: 10}, norm)
            ).resolves.toEqual({
                a: 3,
                b: 4
            })
        })

        it('async array', async () => {
            let n = 1

            const norm = {fields: [
                {path: 'a', $p: [
                    {$$u: callback => setTimeout(() => callback(null, 3), 10)}
                ]},
                {path: 'b', fields: [
                    {path: 'n', $default: () => n++},
                    {path: 'c', $p: [
                        {$$u: (c, b, bs, parent, callback) => {
                            n++
                            setTimeout(() => {
                                callback(null, n++)
                            }, 10)
                        }}
                    ]},
                    {path: 'n2', $default: () => n++}
                ]},
            ]}

            await expect(
                dd.normalizeAsync({a: 1, b: [{}, {}, {}]}, norm)
            ).resolves.toEqual({
                a: 3,
                b: [
                    {n: 1, c: 5, n2: 10},
                    {n: 2, c: 7, n2: 11},
                    {n: 3, c: 9, n2: 12}
                ]
            })
        })
    })
})