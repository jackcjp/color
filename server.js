const fs = require('fs');
const mbgl = require('@mapbox/mapbox-gl-native');
const sharp = require('sharp');
const betterSqlite = require('better-sqlite3');
const mercator = new (require('@mapbox/sphericalmercator'))();
const zlib = require('zlib');
const path = require('path');

const limit = 1000;
const tileSize = 256,
    scale = 1,
    bearing = 0,
    pitch = 0,
    ratio = 1;
let topRightCorner = [-90.0, -180.0];

mbgl.on('message', function(err) {
    if (err.severity === 'WARNING' || err.severity === 'ERROR') {
        console.log('mbgl:', err);
    }
});

let changeColorAndFormat = function(zoom, x, y, lon, lat, tileData) {
    try {
        const options = {
            mode: "tile",
            request: function(req, callback) {
                callback(null, { data: zlib.unzipSync(tileData) });
            },
            ratio
        };
        // console.log('options',options);
        const map = new mbgl.Map(options);
        map.load(require('./style/fixtures/style.json'));

        const params = {
            zoom: zoom,
            center: [lon, lat],
            bearing,
            pitch,
            width: tileSize * 2,
            height: tileSize * 2
        };

        return new Promise((resolve, reject) => {
            map.render(params, async function(error, buffer) {
                if (error) {
                    console.error(error);
                    reject(error);
                }
                map.release();
                const image = sharp(buffer, {
                    raw: {
                        width: params.width,
                        height: params.width,
                        channels: 4
                    }
                });
                return image.resize(tileSize, tileSize).toFormat(sharp.format.webp).toBuffer()
                .then(data => { resolve({'zoom_level':zoom, 'tile_column':x ,'tile_row':y, 'tile_data': data}) })
                .catch( err => { 
                    console.err(err);
                    reject(err); 
                });
            });
        });
    } catch(err) {
        console.log('change color and format err:', err);
    }
}
let connectDb = function(dbPath) {
    return betterSqlite(dbPath, /*{ verbose: console.log }*/);
}
let createDb = function(inputPath, outputPath) {
    let db = connectDb(outputPath);
    db.prepare('CREATE TABLE metadata (name text, value text)').run();
    db.prepare(`ATTACH '${inputPath}' AS A;`).run();
    db.prepare(`INSERT INTO metadata (name, value) SELECT name, value FROM A.metadata;`).run();
    db.prepare(`UPDATE metadata SET value = 'webp' WHERE name = 'format';`).run();
    db.prepare('CREATE TABLE tiles (zoom_level integer NOT NULL, tile_column integer NOT NULL, tile_row integer NOT NULL, tile_data blob)').run();
    return betterSqlite(outputPath, /*{ verbose: console.log }*/);
}
let createIndex = function(outputPath) {
    let db = connectDb(outputPath);
    db.prepare('CREATE UNIQUE INDEX tile_index ON tiles ( "zoom_level" ASC,"tile_column" ASC, "tile_row" ASC);').run();
}

const scaleDenominator_dic = {
    '0': 279541132.014358,
    '1': 139770566.007179,
    '2': 69885283.0035897,
    '3': 34942641.5017948,
    '4': 17471320.7508974,
    '5': 8735660.37544871,
    '6': 4367830.18772435,
    '7': 2183915.09386217,
    '8': 1091957.54693108,
    '9': 545978.773465544,
    '10': 272989.386732772,
    '11': 136494.693366386,
    '12': 68247.346683193,
    '13': 34123.6733415964,
    '14': 17061.8366707982,
    '15': 8530.91833539913,
    '16': 4265.45916769956,
    '17': 2132.72958384978
};


let truncate_lnglat = function(lng, lat) {
    if (lng > 180.0) {
        lng = 180.0
    }
    else if (lng < -180.0) {
        lng = -180.0
    }
    if (lat > 90.0) {
        lat = 90.0
    }
    else if (lat < -90.0) {
        lat = -90.0
    }
    return [lng, lat];
}

let ul = function(z, x, y, curCorner) {
    let scaleDenominator = scaleDenominator_dic[(z).toString()];
    let res = scaleDenominator * 0.00028 / (2 * Math.PI * 6378137 / 360.0);
    let origin_x = curCorner ? curCorner[1] : topRightCorner[1];
    let origin_y = curCorner ? curCorner[0] : topRightCorner[0];
    let lon = origin_x + x * res * tileSize;
    let lat = origin_y - y * res * tileSize;
    return [lon, lat];
}

let calCenter = function(z, x, y) {
    let lt = ul(z, x, y);
    let left = lt[0], top = lt[1];
    let rb = ul(z, x + 1, y + 1);
    let right = rb[0], bottom = rb[1];
    let curCorner = [parseFloat(top.toFixed(20)), parseFloat((-right).toFixed(20))];
    // console.log('curCorner', curCorner);
    let center = ul(z, x, y, curCorner);
    return truncate_lnglat.apply(null, center);
}

let readMbtiles = async function() {
    const args = process.argv.splice(2);
    console.log('args:', args);
    inputpath = args[0];
    outputPath = path.basename(inputpath, '.mbtiles') + '_webp' + '.mbtiles';
    console.log('outputPath:', outputPath)
    if (!fs.existsSync(inputpath)) {
        throw Error(`path ${inputpath} not existed!`, inputpath);
    }
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    let db = connectDb(inputpath);
    let outputDb = createDb(inputpath, outputPath);
    let startTime = Date.now();
    let count = db.prepare(`SELECT count(*) from tiles;`).pluck().get();
    let pageCount = Math.ceil(count/limit);
    // let pageCount =1;
    console.log('Total count', count, ', page count', pageCount, ', page limit', limit);
    let currCount = 0;
    for (let i = 0; i < pageCount; i++) {
        let offset = i * limit;
        let data = db.prepare(`SELECT * from tiles limit ${limit} offset ${offset};`).all();
        // let data = db.prepare(`SELECT * from tiles where zoom_level in (0, 1, 2);`).all();
        console.log('progress: ', offset, '-', offset + data.length);
        currCount += data.length;
        let insert = outputDb.prepare(`INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (@zoom_level, @tile_column, @tile_row, @tile_data);`);
        let res = [];
        for (let item of data) {
            let z = item.zoom_level, x = item.tile_column, y = item.tile_row, tile_data = item.tile_data;
            const tileCenter = calCenter(z, x, y);
            // console.log('z',z,'x', x, 'y',y, 'topRightCorner',topRightCorner,'tileCenter', tileCenter);
            // console.log('z',z,'x', x, 'y',y, 'topRightCorner',topRightCorner,'tileCenter', tileCenter[0].toFixed(20), tileCenter[1].toFixed(20));
            item.tile_data = changeColorAndFormat(z, x, y, tileCenter[0].toFixed(20), tileCenter[1].toFixed(20), tile_data);
            res.push(item.tile_data);
        }
        let readyData = await Promise.all(res);
        // .then(async (newData) => {
        let insertMany = db.transaction(async (ndata) => {
            for (let item of ndata) {
                insert.run(item);
            }
        });
        await insertMany(readyData);
        console.log('Insert count', currCount);
        // });
    }
    console.log('Create index ...');
    createIndex(outputPath);
    console.log('Create index finished!');
    console.log('Finshed! Total time cost:', (Date.now() - startTime) / 1000 / 60);
}

readMbtiles()

// run script local, recommand use docker envrionment
// sudo apt-get update && sudo apt-get install xvfb && npm install
// EGL_LOG_LEVEL=debug
// output: /input/db/path_webp.mbtiles located at the same path
// xvfb-run -a -s '-screen 0 800x600x24' node server.js /input/db/path
// e.g.: xvfb-run -a -s '-screen 0 800x600x24' node server.js ./test1_100_90_1.mbtiles
