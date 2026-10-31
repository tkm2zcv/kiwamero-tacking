let wasm;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc_command_export();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store_command_export(idx);
    }
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function isLikeNone(x) {
    return x === undefined || x === null;
}
/**
 * Single-threaded build: accepts the same call as the threaded build and
 * resolves immediately, so one Worker script can load either build.
 * @param {number} _num_threads
 * @returns {Promise<any>}
 */
export function initThreadPool(_num_threads) {
    const ret = wasm.initThreadPool(_num_threads);
    return ret;
}

/**
 * Whether this build runs inference on multiple threads (`true` only for
 * the `threads` build).
 * @returns {boolean}
 */
export function threadsSupported() {
    const ret = wasm.threadsSupported();
    return ret !== 0;
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc_command_export(idx);
    return value;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * Chroma subsampling format
 * @enum {0 | 1 | 2 | 3}
 */
export const ChromaSampling = Object.freeze({
    /**
     * Both vertically and horizontally subsampled.
     */
    Cs420: 0, "0": "Cs420",
    /**
     * Horizontally subsampled.
     */
    Cs422: 1, "1": "Cs422",
    /**
     * Not subsampled.
     */
    Cs444: 2, "2": "Cs444",
    /**
     * Monochrome.
     */
    Cs400: 3, "3": "Cs400",
});

const OcrEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ocrengine_free(ptr >>> 0, 1));
/**
 * OCR engine. `run` is synchronous; call it from a Web Worker to keep the
 * page responsive.
 */
export class OcrEngine {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OcrEngine.prototype);
        obj.__wbg_ptr = ptr;
        OcrEngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OcrEngineFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ocrengine_free(ptr, 0);
    }
    /**
     * Same as `run`, plus stage timings in milliseconds and the detected
     * page orientation: `{ results, timings, docOrientationAngle }`.
     * @param {Uint8Array} image
     * @returns {object}
     */
    runWithMetrics(image) {
        const ptr0 = passArray8ToWasm0(image, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ocrengine_runWithMetrics(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Number of threads this engine runs inference on.
     * @returns {number}
     */
    get inferenceThreads() {
        const ret = wasm.ocrengine_inferenceThreads(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Runs OCR on an encoded image (PNG, JPEG, ...).
     *
     * Returns `[{ text, confidence, box, polygon }, ...]`: `box` is the rotated
     * 4-point rectangle (top-left first, clockwise). `polygon` contains the
     * engine's bounding-box exterior without its repeated closing point;
     * it is not the original detection contour. Coordinates are input pixels.
     * @param {Uint8Array} image
     * @returns {Array<any>}
     */
    run(image) {
        const ptr0 = passArray8ToWasm0(image, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ocrengine_run(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) OcrEngine.prototype[Symbol.dispose] = OcrEngine.prototype.free;

const OcrEngineBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ocrenginebuilder_free(ptr >>> 0, 1));
/**
 * Builder mirroring `pure_onnx_ocr::OcrEngineBuilder` with in-memory inputs.
 */
export class OcrEngineBuilder {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OcrEngineBuilder.prototype);
        obj.__wbg_ptr = ptr;
        OcrEngineBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OcrEngineBuilderFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ocrenginebuilder_free(ptr, 0);
    }
    /**
     * `"max"` (default) bounds the longest side, `"min"` the shortest side.
     * @param {string} limit_type
     * @returns {OcrEngineBuilder}
     */
    detLimitType(limit_type) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passStringToWasm0(limit_type, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_detLimitType(ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return OcrEngineBuilder.__wrap(ret[0]);
    }
    /**
     * Recognition batch size (default 1; with tract, one crop per batch is
     * fastest because it avoids padding crops to a common width).
     * @param {number} size
     * @returns {OcrEngineBuilder}
     */
    recBatchSize(size) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.ocrenginebuilder_recBatchSize(ptr, size);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Plain text dictionary (one character per line), e.g. `ppocrv5_dict.txt`.
     * @param {string} text
     * @returns {OcrEngineBuilder}
     */
    dictionaryText(text) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_dictionaryText(ptr, ptr0, len0);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Number of inference threads. Defaults to the size of the pool started
     * by `initThreadPool` and is capped to it; always 1 in the
     * single-threaded build. Same as the Rust builder's `inference_threads`.
     * @param {number} threads
     * @returns {OcrEngineBuilder}
     */
    inferenceThreads(threads) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.ocrenginebuilder_inferenceThreads(ptr, threads);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Detection size limit (default 960, longest side).
     * @param {number} len
     * @returns {OcrEngineBuilder}
     */
    detLimitSideLen(len) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.ocrenginebuilder_detLimitSideLen(ptr, len);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Optional document orientation classifier (`PP-LCNet_x1_0_doc_ori`).
     * @param {Uint8Array} model
     * @param {string} config_yaml
     * @returns {OcrEngineBuilder}
     */
    docOrientationModel(model, config_yaml) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArray8ToWasm0(model, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(config_yaml, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_docOrientationModel(ptr, ptr0, len0, ptr1, len1);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Optional text-line orientation classifier (`PP-LCNet_x0_25_textline_ori`).
     * @param {Uint8Array} model
     * @param {string} config_yaml
     * @returns {OcrEngineBuilder}
     */
    textlineOrientationModel(model, config_yaml) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArray8ToWasm0(model, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(config_yaml, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_textlineOrientationModel(ptr, ptr0, len0, ptr1, len1);
        return OcrEngineBuilder.__wrap(ret);
    }
    constructor() {
        const ret = wasm.ocrenginebuilder_new();
        this.__wbg_ptr = ret >>> 0;
        OcrEngineBuilderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Loads the models and returns a ready engine.
     * @returns {OcrEngine}
     */
    build() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.ocrenginebuilder_build(ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return OcrEngine.__wrap(ret[0]);
    }
    /**
     * `"rotated"` (default) or `"axis"`.
     * @param {string} mode
     * @returns {OcrEngineBuilder}
     */
    cropMode(mode) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_cropMode(ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return OcrEngineBuilder.__wrap(ret[0]);
    }
    /**
     * Detection model: `inference.onnx` bytes and `inference.yml` text.
     * @param {Uint8Array} model
     * @param {string} config_yaml
     * @returns {OcrEngineBuilder}
     */
    detModel(model, config_yaml) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArray8ToWasm0(model, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(config_yaml, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_detModel(ptr, ptr0, len0, ptr1, len1);
        return OcrEngineBuilder.__wrap(ret);
    }
    /**
     * Recognition model: `inference.onnx` bytes and `inference.yml` text
     * (the dictionary embedded in the YAML is used).
     * @param {Uint8Array} model
     * @param {string} config_yaml
     * @returns {OcrEngineBuilder}
     */
    recModel(model, config_yaml) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArray8ToWasm0(model, wasm.__wbindgen_malloc_command_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(config_yaml, wasm.__wbindgen_malloc_command_export, wasm.__wbindgen_realloc_command_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ocrenginebuilder_recModel(ptr, ptr0, len0, ptr1, len1);
        return OcrEngineBuilder.__wrap(ret);
    }
}
if (Symbol.dispose) OcrEngineBuilder.prototype[Symbol.dispose] = OcrEngineBuilder.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_Error_e83987f665cf5504 = function(arg0, arg1) {
        const ret = Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_undefined_2d472862bd29a478 = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_call_e762c39fa8ea36bf = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_getRandomValues_a8ddca022803a145 = function() { return handleError(function (arg0, arg1) {
        globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
    }, arguments) };
    imports.wbg.__wbg_new_1acc0b6eea89d040 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_e17d9f43105b08be = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_no_args_ee98eee5275000a4 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_now_2c95c9de01293173 = function(arg0) {
        const ret = arg0.now();
        return ret;
    };
    imports.wbg.__wbg_performance_7a3ffd0b17f663ad = function(arg0) {
        const ret = arg0.performance;
        return ret;
    };
    imports.wbg.__wbg_push_df81a39d04db858c = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_resolve_caf97c30b83f7053 = function(arg0) {
        const ret = Promise.resolve(arg0);
        return ret;
    };
    imports.wbg.__wbg_set_c2abbebe8b9ebee1 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_static_accessor_GLOBAL_89e1d9ac6a1b250e = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_8b530f326a9e48ac = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_6fdf4b64710cc91b = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_b45bfc5a37f6cfa2 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_cast_d6cd19b81560fd6e = function(arg0) {
        // Cast intrinsic for `F64 -> Externref`.
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('pure_onnx_ocr_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
