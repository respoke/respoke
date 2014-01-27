
var expect = chai.expect;

describe("The Object prototype", function() {
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
