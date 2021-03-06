"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const gpg = __importStar(require("./gpg"));
const compiler_1 = require("./compiler");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (process.arch != "x64")
                throw new Error("Only x64 arch is supported by all platforms");
            const input = core.getInput('compiler') || "dmd-latest";
            const gh_token = core.getInput('gh_token') || "";
            const descr = yield compiler_1.compiler(input, gh_token);
            console.log(`Enabling ${input}`);
            const cache_tag = descr.name + "-" + descr.version + (descr.download_dub ? "+dub" : "");
            let cached = tc.find('dc', cache_tag);
            if (cached) {
                console.log("Using cache");
            }
            else {
                console.log(`Downloading ${descr.url}`);
                const archive = yield tc.downloadTool(descr.url);
                if (descr.sig) {
                    console.log("Verifying the download with GPG");
                    yield gpg.install();
                    yield gpg.verify(archive, descr.sig);
                }
                const dc_path = yield extract(descr.url, archive);
                if (descr.download_dub) {
                    const dub = yield compiler_1.legacyDub();
                    const archive2 = yield tc.downloadTool(dub.url);
                    yield extract(dub.url, archive2, dc_path + descr.binpath);
                }
                cached = yield tc.cacheDir(dc_path, 'dc', cache_tag);
            }
            const binpath = cached + descr.binpath;
            console.log("Adding '" + binpath + "' to path");
            core.addPath(binpath);
            core.exportVariable("DC", descr.name);
            const libpath = cached + descr.libpath;
            console.log("Adding '" + libpath + "' to library path");
            if (process.platform == "win32") {
                core.addPath(cached + descr.libpath);
            }
            else {
                core.exportVariable("LD_LIBRARY_PATH", libpath);
            }
            console.log("Done");
        }
        catch (error) {
            console.log(error);
            core.setFailed(error.message);
        }
    });
}
function extract(format, archive, into) {
    return __awaiter(this, void 0, void 0, function* () {
        if (format.endsWith(".7z"))
            return yield tc.extract7z(archive, into);
        else if (format.endsWith(".zip"))
            return yield tc.extractZip(archive, into);
        else if (/\.tar(\.\w+)?$/.test(format))
            return yield tc.extractTar(archive, into, 'x');
        throw new Error("unsupported archive format: " + format);
    });
}
run();
