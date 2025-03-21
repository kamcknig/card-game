import {dirname} from "path";
import path from "path";
import {fileURLToPath} from 'url';
import Dotenv from 'dotenv-webpack';
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default (_env, argv) => {
    const plugins = [
        new Dotenv(),
        // Copy our static assets to the final build
        new CopyPlugin({
            patterns: [{from: "public/"}],
        }),

        // Make an index.html from the template
        new HtmlWebpackPlugin({
            template: "./index.ejs",
            hash: true,
            minify: false,
        }),
    ];

    if (argv.analyze) {
        plugins.push(new BundleAnalyzerPlugin());
    }

    return {
        stats: {
            all: false,
            modules: true,
            reasons: true
        },
        entry: "./src/main.ts", // Your program entry point

        // Your build destination
        output: {
            path: path.resolve(process.cwd(), "dist"),
            filename: "bundle.js",
            clean: true,
        },

        // Config for your testing server
        devServer: {
            compress: true,
            allowedHosts: "all", // If you are using WebpackDevServer as your production server, please fix this line!
            static: false,
            client: {
                logging: "warn",
                overlay: {
                    errors: true,
                    warnings: false,
                },
                progress: true,
            },
            server: {
                type: "http"
            },
            port: 5143,
            host: "0.0.0.0",
        },

        // Web games are bigger than pages, disable the warnings that our game is too big.
        performance: {hints: false},

        // Enable sourcemaps while debugging
        devtool: argv.mode === "development" ? "eval-source-map" : undefined,

        // Minify the code when making a final build
        optimization: {
            minimize: argv.mode === "production",
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        ecma: 6,
                        compress: {drop_console: true},
                        output: {comments: false, beautify: false},
                    },
                }),
            ],
        },

        // Explain webpack how to do Typescript
        module: {
            rules: [
                {
                    test: /\.ts(x)?$/,
                    loader: "ts-loader",
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            alias: {"shared": path.resolve(__dirname, "../shared/src")},
            extensions: [".tsx", ".ts", ".js"],
        },

        plugins,
    };
};
