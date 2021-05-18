import SanitiseQString from "./sanitise-qstring";
import t from "tap";
import expMiddlewareMock from "express-request-mock";

t.test("#SanitiseQString", (t) => {
    t.test("Should allow GET requests with valid data.", async (t) => {
        const { res } = await expMiddlewareMock(SanitiseQString, {
            method: "GET",
            query: {
                foo: "bar",
            },
        });

        t.not(res.statusCode, 400, "Status code should NOT be 400");

        t.end();
    });

    t.test("Should disallow GET requests with nested data.", async (t) => {
        const { res } = await expMiddlewareMock(SanitiseQString, {
            method: "GET",
            query: {
                foo: {
                    bar: "baz",
                },
            },
        });

        t.equal(res.statusCode, 400, "Status code should be 400");

        t.end();
    });

    t.end();
});
