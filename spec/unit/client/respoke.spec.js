
var expect = chai.expect;

var instanceId;
respoke.log.setLevel('error');

var aBool = true;
var aString = "test";
var aNumber = 5;
var anArray = [aBool, aString, aNumber];
var anObject = {
    aBool: aBool,
    aString: aString,
    aNumber: aNumber,
    anArray: anArray
};

describe("respoke", function () {
    describe("isEqual", function () {
        
        it("should return true for the same object", function () {
            expect(respoke.isEqual(anObject, anObject)).to.be.true;
        });
        
        it("should return true for equal objects", function () {
            var testObject = {
                anArray: anArray,
                aNumber: aNumber,
                aString: aString,
                aBool: aBool
            }
            expect(respoke.isEqual(anObject, testObject)).to.be.true;
        });
        
        it("should return true for the same array", function () {
            expect(respoke.isEqual(anArray, anArray));
        });
        
        it("should return true for equal arrays", function () {
            var testArray = [aBool, aString, aNumber];
            expect(respoke.isEqual(anArray, testArray)).to.be.true;
        });
        
        it("should return false for unequal objects", function () {
            var testObject = {
                aBoolTwo: aBool,
                aStringTwo: aString,
                aNumberTwo: aNumber,
                anArrayTwo: anArray
            }
            expect(respoke.isEqual(anObject, testObject)).to.be.false;
        });
        
        it("should return false for arrays with different lengths", function () {
            var testArray = [aBool, aNumber];
            expect(respoke.isEqual(anArray, testArray)).to.be.false;
        });
        
        it("should return false for unequal arrays with the same length", function () {
            var testArray = [aNumber, aString, aBool];
            expect(respoke.isEqual(anArray, testArray));
        });
    });
});
