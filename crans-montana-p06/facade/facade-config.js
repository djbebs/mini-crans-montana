/** P0.6.8 experimental façade overlay. All distances are metres. */
export const CONFIG=Object.freeze({
 maxTrianglesPerTile:45000,maxWindowsPerTile:350,maxWallGroups:220,
 minimumTriangleArea:0.25,minimumWallArea:4,minimumWallHeight:2,
 verticalNormalTolerance:0.20,planeQuantization:0.35,angleBins:64,
 edgeClearance:0.42,windowWidth:0.9,windowHeight:1.15,
 rowPitch:2.85,columnPitch:2.25,sillOffset:0.85,
 surfaceOffset:0.045,boundsHalfSize:50,geometryBudgetMs:12
});
export const STYLES=Object.freeze({
 alpine_chalet:{glass:0x46657a,frame:0x765336,width:0.78,height:0.95},
 apartment:{glass:0x56728a,frame:0xd9cbb4,width:1.05,height:1.20},
 hotel_commercial:{glass:0x365974,frame:0x9b8064,width:1.3,height:1.38},
 modern:{glass:0x34576a,frame:0x343f46,width:1.45,height:1.42}
});
