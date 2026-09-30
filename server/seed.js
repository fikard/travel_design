const db = require('./db');

const provinces = [
  ['110000','北京市'],['120000','天津市'],['130000','河北省'],['140000','山西省'],
  ['150000','内蒙古自治区'],['210000','辽宁省'],['220000','吉林省'],['230000','黑龙江省'],
  ['310000','上海市'],['320000','江苏省'],['330000','浙江省'],['340000','安徽省'],
  ['350000','福建省'],['360000','江西省'],['370000','山东省'],['410000','河南省'],
  ['420000','湖北省'],['430000','湖南省'],['440000','广东省'],['450000','广西壮族自治区'],
  ['460000','海南省'],['500000','重庆市'],['510000','四川省'],['520000','贵州省'],
  ['530000','云南省'],['540000','西藏自治区'],['610000','陕西省'],['620000','甘肃省'],
  ['630000','青海省'],['640000','宁夏回族自治区'],['650000','新疆维吾尔自治区'],
  ['710000','台湾省'],['810000','香港特别行政区'],['820000','澳门特别行政区']
];
const insP = db.prepare('INSERT OR REPLACE INTO provinces (code,name) VALUES (?,?)');
provinces.forEach(p => insP.run(...p));

const insC = db.prepare('INSERT OR REPLACE INTO cities (code,name,province_code,lat,lng) VALUES (?,?,?,?,?)');
const insPlace = db.prepare(`INSERT INTO places
  (type,name,city_code,category,summary,address,lat,lng,cover,tags,body,official_score)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insDim = db.prepare('INSERT INTO dimensions (place_id,dimension,score) VALUES (?,?,?)');

const demo = {
  '110000': { code:'110000', name:'北京市', province:'110000', lat:39.9, lng:116.4,
    places:[
      { type:'scenic', name:'故宫博物院', category:'历史古迹', summary:'明清皇宫，世界文化遗产',
        address:'北京市东城区景山前街4号', lat:39.916, lng:116.397, official:4.8,
        tags:['历史','打卡','必去'], body:'故宫又称紫禁城，是明清两代的皇家宫殿……',
        dims:{风景:4.9, 趣味:4.7, 性价比:4.6, 服务:4.5} },
      { type:'food', name:'全聚德烤鸭', category:'京菜', summary:'百年老字号挂炉烤鸭',
        address:'北京市东城区前门大街30号', lat:39.899, lng:116.398, official:4.5,
        tags:['烤鸭','老字号'], body:'全聚德始创于1864年，果木挂炉烤鸭皮酥肉嫩……',
        dims:{口味:4.8, 环境:4.3, 服务:4.4, 性价比:3.9} }
    ] },
  '510100': { code:'510100', name:'成都市', province:'510000', lat:30.57, lng:104.06,
    places:[
      { type:'scenic', name:'大熊猫繁育研究基地', category:'自然生态', summary:'近距离观国宝大熊猫',
        address:'成都市成华区熊猫大道1375号', lat:30.736, lng:104.131, official:4.9,
        tags:['熊猫','亲子'], body:'基地内有大熊猫和小熊猫等，建议早晨前往……',
        dims:{风景:4.7, 趣味:4.9, 性价比:4.5, 服务:4.6} },
      { type:'food', name:'陈麻婆豆腐', category:'川菜', summary:'麻婆豆腐发源地',
        address:'成都市青羊区西玉龙街197号', lat:30.663, lng:104.065, official:4.6,
        tags:['川菜','豆腐'], body:'麻辣鲜香，豆腐嫩滑，是川菜代表……',
        dims:{口味:4.8, 环境:4.0, 服务:4.2, 性价比:4.4} }
    ] },
  '440100': { code:'440100', name:'广州市', province:'440000', lat:23.13, lng:113.26,
    places:[
      { type:'activity', name:'珠江夜游', category:'水上观光', summary:'夜赏花城两岸灯光',
        address:'广州市越秀区天字码头', lat:23.11, lng:113.27, official:4.4,
        tags:['夜游','江景'], body:'乘船夜游珠江，两岸建筑灯火璀璨……',
        dims:{刺激度:3.8, 性价比:4.0, 安全:4.8, 体验:4.5} }
    ] },
  '530700': { code:'530700', name:'丽江市', province:'530000', lat:26.87, lng:100.23,
    places:[
      { type:'scenic', name:'玉龙雪山', category:'自然风光', summary:'纳西族神山，冰川公园',
        address:'丽江市玉龙纳西族自治县', lat:27.09, lng:100.18, official:4.8,
        tags:['雪山','高海拔'], body:'玉龙雪山是北半球最南端的大雪山……',
        dims:{风景:5.0, 趣味:4.4, 性价比:4.1, 服务:4.3} }
    ] } };

for (const c of Object.values(demo)) {
  insC.run(c.code, c.name, c.province, c.lat, c.lng);
  c.places.forEach(p => {
    const r = insPlace.run(p.type, p.name, c.code, p.category, p.summary, p.address,
      p.lat, p.lng, p.cover || '', JSON.stringify(p.tags), p.body, p.official);
    for (const [dim, sc] of Object.entries(p.dims)) insDim.run(r.lastInsertRowid, dim, sc);
  });
}
// 为无示范城市的省补一个占位城市，保证全国地图非空
const allProv = db.prepare('SELECT code FROM provinces').all();
allProv.forEach(pr => {
  if (!db.prepare('SELECT 1 FROM cities WHERE province_code=?').get(pr.code)) {
    insC.run(pr.code + '01', pr.name + '示例市', pr.code, null, null);
  }
});

const insT = db.prepare('INSERT INTO topics (title,summary,cover,type) VALUES (?,?,?,?)');
const t = insT.run('全国必打卡 TOP', '各地人气与评分最高的景点合集', '', 'scenic');
const insTP = db.prepare('INSERT INTO topic_places (topic_id,place_id,rank) VALUES (?,?,?)');
const topScenic = db.prepare("SELECT id FROM places WHERE type='scenic' ORDER BY official_score DESC LIMIT 10").all();
topScenic.forEach((row,i)=> insTP.run(t.lastInsertRowid, row.id, i+1));

console.log('seed done');