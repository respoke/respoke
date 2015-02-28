// Call a function only if there's a error or on the $num attempt

describe("doneCountBuilder", function () {
    var builderSpy;
    var doneOnce;

    beforeEach(function () {
        builderSpy = sinon.spy();
        doneOnce = doneCountBuilder(4, builderSpy);
    });

    describe("when it's called a fewer number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 2; i += 1) {
                doneOnce();
            }
        });

        it("doesn't call the function", function () {
            expect(builderSpy.called).to.equal(false);
            expect(builderSpy.callCount).to.equal(0);
        });
    });

    describe("when it's called the same number of times as $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 4; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });

    describe("when it's called a greater number of times than $num", function () {
        beforeEach(function () {
            for (var i = 0; i <= 12; i += 1) {
                doneOnce();
            }
        });

        it("calls the function only once", function () {
            expect(builderSpy.called).to.equal(true);
            expect(builderSpy.callCount).to.equal(1);
        });
    });
});
