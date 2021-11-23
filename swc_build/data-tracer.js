import ProxyPolyfillBuilder from "proxy-polyfill/src/proxy";
var ProxyPolyfill = ProxyPolyfillBuilder();
var wrapData = function(data, relatedPathValues, basePath) {
    if (typeof data !== "object" || data === null) return data;
    var handler = {
        get: function(_obj, key) {
            if (key === "__rawObject__") return data;
            var keyWrapper = null;
            var keyPath = basePath.concat(key);
            var value = data[key];
            relatedPathValues.push({
                path: keyPath,
                value: value
            });
            keyWrapper = wrapData(value, relatedPathValues, keyPath);
            return keyWrapper;
        }
    };
    // for test
    // const Proxy = undefined;
    var propDef;
    try {
        propDef = new Proxy(data, handler);
    } catch (e) {
        // console.log("[miniprogram-computed]: use Proxy Polyfill");
        propDef = new ProxyPolyfill(data, handler);
    }
    return propDef;
};
export function create(data, relatedPathValues) {
    return wrapData(data, relatedPathValues, []);
}
export function unwrap(wrapped) {
    if (typeof wrapped !== "object" || wrapped === null || typeof wrapped.__rawObject__ !== "object") {
        return wrapped;
    }
    return wrapped.__rawObject__;
}
