// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 8080;

// 데이터 파일을 저장할 기본 폴더
app.use(express.static('maps')); // 정적 파일 제공
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.urlencoded({ extended: true })); // 폼 데이터를 해석하기 위해
const BASE_DATA_PATH = path.join(__dirname, 'data');

app.use(express.json());

// 폴더가 존재하지 않으면 생성
function ensureDataFolderExists(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
}


// multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const mapId = req.params.mapId;
        const mapPath = path.join(BASE_DATA_PATH, mapId);
        if (!fs.existsSync(mapPath)) {
            fs.mkdirSync(mapPath, { recursive: true });
        }
        cb(null, mapPath);
    },
    filename: (req, file, cb) => {
        cb(null, 'map.svg');
    }
});

const upload = multer({ storage: storage });

// 맵 추가 페이지
app.get('/addmap', (req, res) => {
    res.send(`
        <h1>새 맵 추가</h1>
        <form action="/addmap" method="post">
            <label for="mapName">맵 이름:</label>
            <input type="text" id="mapName" name="mapName" required><br><br>
            <input type="submit" value="맵 추가">
        </form>
    `);
});
// 맵 추가 처리
app.post('/addmap', (req, res) => {
    const mapName = req.body.mapName;
    const mapPath = path.join(BASE_DATA_PATH, mapName);
    if (!fs.existsSync(mapPath)) {
        fs.mkdirSync(mapPath, { recursive: true });
        fs.writeFileSync(path.join(mapPath, 'crowdData.json'), '{}', 'utf8');
        // HTML 파일 생성
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mapName} - 인구 밀도 알리미</title>
</head>
<body>
    <h1>${mapName} - 인구 밀도 알리미</h1>
    <a href="/crowd-count/${mapName}"><button>군중 수 입력</button></a>
    <form action="/upload-map/${mapName}" method="post" enctype="multipart/form-data">
        <label for="mapFile">SVG 파일 업로드:</label>
        <input type="file" id="mapFile" name="mapFile" accept=".svg" required><br><br>
        <input type="submit" value="업로드">
    </form>

    <div id="mapContainer">
        <embed src="/data/${mapName}/map.svg" type="image/svg+xml" width="800" height="600" />
    </div>
    <p>여기에 ${mapName}의 세부 사항을 표시합니다.</p>
    <a href="/">홈으로 돌아가기</a>
</body>
</html>
        `;
        fs.writeFileSync(path.join('maps', `${mapName}.html`), htmlContent, 'utf8');
        res.send(`맵 '${mapName}'이(가) 성공적으로 추가되었습니다. <a href="/">홈으로 돌아가기</a>`);
    } else {
        res.send(`맵 '${mapName}'은(는) 이미 존재합니다. <a href="/">홈으로 돌아가기</a>`);
    }
});


// 파일에 데이터 저장
function saveData(mapId, data) {
    const folderPath = path.join(BASE_DATA_PATH, mapId);
    ensureDataFolderExists(folderPath);
    const filePath = path.join(folderPath, 'crowdData.json');

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Failed to write to data file for map ${mapId}:`, error);
    }
}


// 초기 페이지를 렌더링하는 라우트
app.get('/', (req, res) => {
    const maps = fs.readdirSync(BASE_DATA_PATH).filter(file => fs.statSync(path.join(BASE_DATA_PATH, file)).isDirectory());
    let html = '<h1>인구 밀도 알리미</h1>';
    html += '<a href="/addmap"><button>맵 추가</button></a><br><br>';
    maps.forEach(map => {
        html += `<p><a href="/map/${map}">${map}</a></p>`;
    });
    res.send(html);
});


// 맵 상세 페이지
app.get('/map/:mapId', (req, res) => {
    const mapId = req.params.mapId;
    // 맵 파일이 있다고 가정하고 링크 제공 (실제 파일 경로는 적절히 설정해야 함)
    res.sendFile(path.join(__dirname, 'maps', `${mapId}.html`));
});

// 군중 데이터 입력 페이지
app.get('/crowd-count/:mapId', (req, res) => {
    const mapId = req.params.mapId;
    res.send(`
        <h1>군중 수 입력 - ${mapId}</h1>
        <form action="/update-crowd/${mapId}" method="post">
            <label for="areaId">Area ID:</label>
            <input type="text" id="areaId" name="areaId"><br><br>
            <label for="density">Density:</label>
            <input type="number" id="density" name="density"><br><br>
            <input type="submit" value="Submit">
        </form>
    `);
});




// 군중 데이터를 받아서 저장
app.post('/update-crowd/:mapId', (req, res) => {
    const mapId = req.params.mapId;
    const { areaId, density } = req.body;
    const folderPath = path.join(BASE_DATA_PATH, mapId);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    const filePath = path.join(folderPath, 'crowdData.json');
    let crowdData = {};
    if (fs.existsSync(filePath)) {
        crowdData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    crowdData[areaId] = density;
    fs.writeFileSync(filePath, JSON.stringify(crowdData, null, 2), 'utf8');
    res.send(`Data for ${mapId} updated successfully.`);
});

// 군중 데이터를 클라이언트에 제공
app.get('/crowd-data/:mapId', (req, res) => {
    const mapId = req.params.mapId;
    const crowdData = loadData(mapId);
    res.status(200).json(crowdData);
});

// 맵 SVG 파일 업로드
app.post('/upload-map/:mapId', upload.single('mapFile'), (req, res) => {
    const mapId = req.params.mapId;
    res.send(`맵 SVG 파일이 성공적으로 업로드되었습니다. <a href="/map/${mapId}">맵으로 돌아가기</a>`);
});


// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
