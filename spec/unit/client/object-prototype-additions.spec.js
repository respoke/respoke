
var expect = chai.expect;

describe("The Object prototype", function() {
    /*
    * Make sure the forOwn function exists.
    * Make sure it loops through keys in an object.
    * Make sure it returns all keys that are proper attributes.
    * Make sure it doesn't return some things in the prototype chain.
    */
    it("contains a new function 'forOwn'", function() {
        var keys = [];
        var testObject = {
          "myNumber": 1,
          "myString": "happy",
          "myObject": {'answer': 42},
          "myArray": [1, 2, 3],
          "myNull": null,
          "myBool": true
        };

        // Manipulate the prototype two different ways.
        // For some reason, testObject.prototype is undefined, but testObject.__proto__ is not.
        Object.defineProperty(testObject, 'dontFindThis', function() { return true; });
        testObject.__proto__.dontFindThisEither = true;

        expect(typeof Object.forOwn).to.equal('function');

        testObject.forOwn(function (value, key) {
          keys.push(key);
        });

        expect(keys).to.not.include('dontFindThis');
        expect(keys).to.not.include('dontFindThisEither');
        expect(keys).to.not.include('toString');
        expect(keys).to.include('myNumber');
        expect(keys).to.include('myString');
        expect(keys).to.include('myObject');
        expect(keys).to.include('myArray');
        expect(keys).to.include('myNull');
        expect(keys).to.include('myBool');
    });

    /*
    * Make sure the isNumber function exists.
    * Make sure it can handle all kinds of input.
    * Make sure it returns true for every finite number.
    * Make sure it returns false for every non-number and Infinity.
    * TODO: Figure out how to test Infinity.
    */
    it("contains a new function 'isNumber'", function() {
        var func = new Function();
        expect(typeof Object.isNumber).to.equal('function');
        expect(Object.isNumber(1)).to.equal(true);
        expect(Object.isNumber(189098987)).to.equal(true);
        expect(Object.isNumber(3454/33453)).to.equal(true);
        expect(Object.isNumber(3454.3454)).to.equal(true);
        expect(Object.isNumber(null)).to.equal(false);
        expect(Object.isNumber(undefined)).to.equal(false);
        expect(Object.isNumber(Object)).to.equal(false);
        expect(Object.isNumber([1, 2, 3])).to.equal(false);
        expect(Object.isNumber(new Object())).to.equal(false);
        expect(Object.isNumber(func)).to.equal(false);
        expect(Object.isNumber("happy octopus")).to.equal(false);
        expect(Object.isNumber("5")).to.equal(false);
    });

    /*
    * Make sure the publicize function exists.
    * Make sure it accepts a function, adds it to this, and returns it.
    */
    it("contains a new function 'publicize'", function() {
        var myInstance = new Function();
        expect(typeof Object.publicize).to.equal('function');
        var aNewFunction = myInstance.publicize('aNewFunction', function() {
            return "Hello, world!";
        });
        expect(aNewFunction).to.equal(myInstance.aNewFunction);
    });
});