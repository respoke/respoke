
var expect = chai.expect;

var instanceId;

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
        
        it("should return true for equal objects with nesting", function () {
            var testObject1 = {
                aNumber: aNumber,
                anArray: anArray,
                anObject: anObject,
                aString: aString,
                aBool: aBool
            };
            var testObject2 = {
                aNumber: aNumber,
                anObject: anObject,
                aString: aString,
                anArray: anArray,
                aBool: aBool
            };
            expect(respoke.isEqual(testObject1, testObject2)).to.be.true;
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
        
        it("should return false for unequal objects with nesting", function () {
            var testObject1 = {
                anArray: anArray,
                anObject: anObject,
                aString: aString,
                aBool: aBool
            };
            var testObject2 = {
                anObject: {
                    aBool: false, 
                    aString: aString, 
                    aNumber: aNumber,
                    anArray: anArray
                },
                aString: aString,
                anArray: anArray,
                aBool: aBool
            };
            
            
            expect(respoke.isEqual(testObject1, testObject2)).to.be.false;
        });
        
        it("should return false for arrays with different lengths", function () {
            var testArray = [aBool, aNumber];
            expect(respoke.isEqual(anArray, testArray)).to.be.false;
        });
        
        it("should return false for unequal arrays with the same length", function () {
            var testArray = [aNumber, aString, aBool];
            expect(respoke.isEqual(anArray, testArray));
        });
        
        it("should return true for the same boolean values", function () {
            expect(respoke.isEqual(true, true)).to.be.true;
        });
        
        it("should return true for the same object", function () {
            expect(respoke.isEqual('test', 'test')).to.be.true;
        });
        
        it("should return true for the same number values", function () {
            expect(respoke.isEqual(5, 5)).to.be.true;
        });
        
        it("should return false for different boolean values", function () {
            expect(respoke.isEqual(true, false)).to.be.false;
        });
        
        it("should return false for different number values", function () {
            expect(respoke.isEqual(5, 6)).to.be.false;
        });
        
        it("should return false for different string values", function () {
            expect(respoke.isEqual('test', 'no test')).to.be.false;
        });
    });
});
