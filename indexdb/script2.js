// 使用 'DOMContentLoaded' 事件确保DOM完全加载后再执行
// 这比 defer 更保险，可以处理更复杂的加载情况
window.addEventListener('DOMContentLoaded', (event) => {

    console.log("DOM fully loaded and parsed. Starting IndexedDB process...");

    // 打开或创建一个数据库，版本号设为 1
    var request = indexedDB.open('boot', 1);
    console.log("request:", request);

    // 处理数据库升级（当版本号变化时触发）
    request.onupgradeneeded = function (event) {
        console.log("onupgradeneeded event:", event);
        var db = event.target.result;

        // 如果对象存储不存在，则创建它
        if (!db.objectStoreNames.contains('meetinglog')) {
            // 创建对象存储（表）并设置主键
            var objectStore = db.createObjectStore('meetinglog', { keyPath: 'id' });
            console.log("Object store 'meetinglog' created.");

            // 创建索引（注意：你的索引 'username' 指向 'id'，这有点奇怪，但保留原样）
            // 通常索引会指向非主键字段，例如: objectStore.createIndex('username_idx', 'username', { unique: false });
            objectStore.createIndex('username', 'id', { unique: false });
            console.log("Index 'username' created.");
        }
    };

    // 数据库打开成功时的回调
    request.onsuccess = function (event) {
        console.log("request.onsuccess event:", event);
        var db = event.target.result;
        console.log("Database opened successfully.");

        // 进行事务操作
        var transaction = db.transaction('meetinglog', 'readwrite');
        var objectStore = transaction.objectStore('meetinglog');

        // 监听事务完成事件
        transaction.oncomplete = function() {
            console.log("Transaction completed: database modification finished.");
        };

        transaction.onerror = function() {
            console.error("Transaction failed:", transaction.error);
        };

        // 插入数据
        objectStore.add({ id: 1, username: '李四', text: "我提议：2025年12月设立健康事业部，由张三担任执行官。" });
        objectStore.add({ id: 2, username: '张三', text: "我附议。" });
        console.log("Data added to object store.");

        // 查询数据
        var query = objectStore.get(1);
        query.onsuccess = function (event) {
            console.log("query.onsuccess event:", event);
            console.log("Query result for id=1:", event.target.result);
        };
        query.onerror = function(event) {
            console.error("Query failed:", query.error);
        };
    };

    // 错误处理
    request.onerror = function (event) {
        console.log("onerror event:", event);
        console.error('Database error:', event.target.error);
    };

});