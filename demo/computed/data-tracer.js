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
            // 这里有一个递归结构,用于拼接relatedPathValues,递归结构中所有relatedPathValues指向同一个数组
            // 假设有个数据路径为a.b:
            // 1.在访问a的时候relatedPathValues为['a'],此时把a丢入wrapData进行递归
            // 2.a由于是个对象,被proxy代理,a.b访问b的时候触发proxy,此时的relatedPathValues为['a','b']
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
