const path = require("path");
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const dotenv = require("dotenv");
const env_vars = dotenv.config().parsed;

const mode = process.env.NODE_ENV || "development";
const minimize = mode === "production";
const plugins = [];
const localhost = "localhost:8000/";

if (mode === "production") {
	plugins.push(new CssMinimizerPlugin({
		minimizerOptions: {
			preset: [ "advanced" ],
		},
	}));
}

// Loaders
const cssLoader = {
	loader: "css-loader",
	options: { sourceMap: minimize }
};
const postcssLoader = {
	// Required for Bootstrap as per the following:
	// https://getbootstrap.com/docs/4.0/getting-started/webpack/#importing-styles
	loader: "postcss-loader",
	options: {
		postcssOptions: {
			plugins: [ "postcss-preset-env" ],
		},
	},
};
const sassLoader = {
	loader: "sass-loader",
	options: { sourceMap: minimize }
};
const styleLoader = {
	test: /\.css$/,
	use: ["style-loader", cssLoader]
};
const jsxLoader = {
	test: /\.jsx?$/,
	exclude: /node_modules/,
	resolve: {
		extensions: [".js", ".jsx"],
	},
	use: [
		{
			loader: "babel-loader",
			options: {
				presets: [
					"@babel/preset-env",
					[
						"@babel/preset-react",
						{ runtime: "automatic", },
					],
				],
				cacheDirectory: true
			}
		},
	]
};
const binaryLoader = {
	test: /\.pdf$/,
	loader: "file-loader",
};

module.exports ={
	mode,
	devtool: "source-map",
	entry: path.resolve(__dirname, "index.js"),
	target: "web",
	resolve: {
		fallback: {
			fs: false,
			os: false,
			path: false
		}
	},
	externals: {
		osjs: "OSjs",
	},
	optimization: {
		minimize,
	},
	plugins: [
		new webpack.DefinePlugin({
			"process.env.PUBLIC_URL": JSON.stringify(minimize ? env_vars.PUBLIC_URL : localhost),
			"process.env.GH_USERNAME": JSON.stringify(env_vars.GH_USERNAME),
			"process.env.GH_PAT": JSON.stringify(env_vars.GH_PAT),
			//"process.env.OAUTH_TOKEN": JSON.stringify(env_vars.OAUTH_TOKEN),
		}),
		new MiniCssExtractPlugin({
			filename: "[name].css",
			chunkFilename: "[id].css"
		}),
		...plugins
	],
	module: {
		rules: [
			binaryLoader,
			styleLoader,
			jsxLoader,
			{
				test: /\.scss$/,
				exclude: /node_modules/,
				use: [
					MiniCssExtractPlugin.loader,
					cssLoader,
					postcssLoader,
					sassLoader,
				]
			},
		]
	}
};
