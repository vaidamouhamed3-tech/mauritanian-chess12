var board = null;
var game = new Chess();
var peer = null;
var conn = null;
var isVsComputer = false;

// بيانات الحساب والرقم القياسي
var myStreak = parseInt(localStorage.getItem('myStreak') || '0');
var topStreak = parseInt(localStorage.getItem('topStreak') || '0');
var topPlayerName = localStorage.getItem('topPlayerName') || 'لا يوجد';

var userProfile = {
    name: "لاعب جديد",
    avatar: "https://chessboardjs.com/img/chesspieces/wikipedia/wK.png"
};

// أصوات الحركة والتنقل
var moveAudio = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/wet/move-self.mp3');

// إعدادات الوقت
var whiteTime = 600;
var blackTime = 600;
var timerInterval = null;
var selectedTimeControl = "none";

function playMoveSound() {
    moveAudio.currentTime = 0;
    moveAudio.play().catch(function(e) {});
}

// حفظ بيانات الحساب
function saveProfile() {
    var nameInput = document.getElementById('usernameInput').value;
    if (nameInput.trim() !== "") {
        userProfile.name = nameInput.trim();
        document.getElementById('displayName').innerText = userProfile.name;
    }
    
    var avatarInput = document.getElementById('avatarInput');
    if (avatarInput.files && avatarInput.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            userProfile.avatar = e.target.result;
            document.getElementById('displayAvatar').src = userProfile.avatar;
        }
        reader.readAsDataURL(avatarInput.files[0]);
    }
    alert("تم حفظ بيانات الحساب بنجاح!");
}

function updateLeaderboardUI() {
    document.getElementById('myStreak').innerText = myStreak;
    document.getElementById('topStreak').innerText = topStreak;
    document.getElementById('topPlayerName').innerText = topPlayerName;
}

function onDragStart (source, piece, position, orientation) {
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
}

function onDrop (source, target) {
    var move = game.move({
      from: source,
      to: target,
      promotion: 'q'
    });

    if (move === null) return 'snapback';

    playMoveSound();
    checkGameEnd();
    updateStatus();

    // إرسال النقلة أونلاين
    if (conn && conn.open) {
        conn.send({ type: 'move', move: move });
    }

    // دور الكمبيوتر إذا كُنت تلعب ضد الذكاء الاصطناعي
    if (isVsComputer && !game.game_over()) {
        window.setTimeout(makeComputerMove, 300);
    }
}

function makeComputerMove() {
    var moves = game.moves();
    if (moves.length === 0) return;
    var randomMove = moves[Math.floor(Math.random() * moves.length)];
    game.move(randomMove);
    board.position(game.fen());
    playMoveSound();
    checkGameEnd();
    updateStatus();
}

function checkGameEnd() {
    if (game.in_checkmate()) {
        clearInterval(timerInterval);
        var winner = (game.turn() === 'w') ? 'الأسود' : 'الأبيض';
        alert("انتهت اللعبة! الفائز هو: " + winner);
        
        // حساب الانتصارات المتتالية والرقام القياسي
        if ((game.turn() === 'b' && !isVsComputer) || (game.turn() === 'b' && isVsComputer)) {
            myStreak++;
            if (myStreak >= 20 && myStreak > topStreak) {
                topStreak = myStreak;
                topPlayerName = userProfile.name;
                localStorage.setItem('topStreak', topStreak);
                localStorage.setItem('topPlayerName', topPlayerName);
                alert("🎉 مبروك! أصبحت الرقم 1 في اللعبة بسلسلة انتصارات: " + myStreak);
            }
            localStorage.setItem('myStreak', myStreak);
        } else {
            myStreak = 0;
            localStorage.setItem('myStreak', 0);
        }
        updateLeaderboardUI();
    }
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus() {
    var turnInfoEl = document.getElementById('turnInfo');
    var moveColor = (game.turn() === 'w') ? 'الأبيض' : 'الأسود';
    turnInfoEl.innerText = "دور: " + moveColor;
}

// التحكم بالتوقيت
function changeTimeControl() {
    selectedTimeControl = document.getElementById('timeControl').value;
    var timerDisplay = document.getElementById('timerDisplay');
    
    if (selectedTimeControl === "none") {
        timerDisplay.style.display = "none";
        clearInterval(timerInterval);
    } else {
        timerDisplay.style.display = "block";
        var mins = parseInt(selectedTimeControl);
        whiteTime = mins * 60;
        blackTime = mins * 60;
        updateTimerDisplay();
        startTimer();
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        if (game.game_over()) {
            clearInterval(timerInterval);
            return;
        }
        if (game.turn() === 'w') {
            whiteTime--;
            if (whiteTime <= 0) {
                clearInterval(timerInterval);
                alert("انتهى الوقت! فاز الأسود.");
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                clearInterval(timerInterval);
                alert("انتهى الوقت! فاز الأبيض.");
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('whiteTimer').innerText = formatTime(whiteTime);
    document.getElementById('blackTimer').innerText = formatTime(blackTime);
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ":" + (s < 10 ? '0' : '') + s;
}

// اللعب ضد الكمبيوتر
function startVsComputer() {
    isVsComputer = true;
    resetGame();
    document.getElementById('opponentName').innerText = "الكمبيوتر 💻";
    document.getElementById('onlineStatus').innerText = "وضع اللعب الفردي ضد الكمبيوتر";
}

// اللعب أونلاين عبر روابط وغرف
function startOnlineGame() {
    isVsComputer = false;
    var urlParams = new URLSearchParams(window.location.search);
    var roomParam = urlParams.get('room');
    
    peer = new Peer();

    peer.on('open', function(id) {
        var roomUrl = window.location.href.split('?')[0] + "?room=" + id;
        document.getElementById('onlineStatus').innerHTML = "ارسل هذا الرابط لصديقك:<br><input type='text' value='" + roomUrl + "' readonly onclick='this.select()'>";
        document.getElementById('chatBox').style.display = "block";

        if (roomParam) {
            conn = peer.connect(roomParam);
            setupConnection();
        }
    });

    peer.on('connection', function(c) {
        conn = c;
        setupConnection();
    });
}

function setupConnection() {
    conn.on('open', function() {
        document.getElementById('onlineStatus').innerText = "تم الاتصال بالخصم أونلاين!";
        document.getElementById('micBtn').style.display = "inline-block";
        conn.send({ type: 'profile', profile: userProfile });
    });

    conn.on('data', function(data) {
        if (data.type === 'move') {
            game.move(data.move);
            board.position(game.fen());
            playMoveSound();
            checkGameEnd();
            updateStatus();
        } else if (data.type === 'profile') {
            document.getElementById('opponentName').innerText = data.profile.name;
        } else if (data.type === 'chat') {
            appendChatMessage(data.sender, data.message);
        }
    });
}

// الدردشة النصية
function sendChatMessage() {
    var input = document.getElementById('chatInput');
    var msg = input.value.trim();
    if (msg !== "") {
        appendChatMessage("أنت", msg);
        if (conn && conn.open) {
            conn.send({ type: 'chat', sender: userProfile.name, message: msg });
        }
        input.value = "";
    }
}

function appendChatMessage(sender, msg) {
    var chatMsgs = document.getElementById('chatMessages');
    chatMsgs.innerHTML += "<div><strong>" + sender + ":</strong> " + msg + "</div>";
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

// التحكم بالمايك
function toggleVoiceChat() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
        var audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            alert(audioTracks[0].enabled ? "تم تشغيل المايك" : "تم كتم المايك");
        }
    }).catch(function(err) {
        alert("تعذر الوصول للميكروفون.");
    });
}

// إعدادات رقعة الشطرنج
var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

function resetGame() {
    game.reset();
    board.start();
    updateStatus();
    changeTimeControl();
}

window.onload = function() {
    board = Chessboard('board', config);
    updateStatus();
    updateLeaderboardUI();

    // فحص ما إذا كان اللاعب قد دخل عبر رابط غرفة أونلاين
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('room')) {
        startOnlineGame();
    }
};
