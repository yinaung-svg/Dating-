const SUPABASE_URL = 'https://dwwubrcbwmxckeklfkan.supabase.co';
const SUPABASE_ANON_KEY = 'Sb_publishable_p1sRpKZnPVyyc-KkEbHWPQ_tkyRTfCu';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isSignUp = false;
let currentUser = null;
let activeChatUserId = null;

// Dark Mode Toggle
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('theme-icon');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
}

// Toggle Auth Form (Sign Up / Log In)
function toggleAuthMode() {
    isSignUp = !isSignUp;
    const usernameField = document.getElementById('username-field');
    const authBtn = document.getElementById('auth-btn');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    
    if (isSignUp) {
        usernameField.classList.remove('hidden');
        authBtn.innerText = 'Sign Up';
        authToggleBtn.innerText = 'Already have an account? Log In';
    } else {
        usernameField.classList.add('hidden');
        authBtn.innerText = 'Log In';
        authToggleBtn.innerText = 'Create new account';
    }
}

// Auth Handler
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('auth-error');
    errorDiv.classList.add('hidden');

    if (isSignUp) {
        const username = document.getElementById('username').value;
        if (!username) {
            errorDiv.innerText = 'Please enter a username';
            errorDiv.classList.remove('hidden');
            return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { errorDiv.innerText = error.message; errorDiv.classList.remove('hidden'); return; }
        if (data.user) {
            await supabase.from('profiles').insert([{ id: data.user.id, username: username, full_name: username }]);
            alert('Sign up successful! Please log in.');
            toggleAuthMode();
        }
    } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { errorDiv.innerText = error.message; errorDiv.classList.remove('hidden'); return; }
        checkUser();
    }
}

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        loadUsers();
        setupRealtimeMessages();
    }
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// Load Users for Chat List
async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*').neq('id', currentUser.id);
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';
    if (data && data.length > 0) {
        data.forEach(user => {
            const div = document.createElement('div');
            div.className = 'p-3 flex items-center space-x-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-facebook-darkhover transition';
            div.innerHTML = `<div class="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold">${user.username[0].toUpperCase()}</div>
                             <div><div class="font-semibold">${user.username}</div></div>`;
            div.onclick = () => selectChatUser(user.id, user.username);
            chatList.appendChild(div);
        });
    } else {
        chatList.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No other users found yet.</div>';
    }
}

function selectChatUser(userId, username) {
    activeChatUserId = userId;
    document.getElementById('active-chat-username').innerText = username;
    document.getElementById('active-user-avatar').innerText = username[0].toUpperCase();
    loadMessages();
}

// Load Messages
async function loadMessages() {
    if (!activeChatUserId) return;
    const { data, error } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUserId}),and(sender_id.eq.${activeChatUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    if (data) {
        data.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const div = document.createElement('div');
            div.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `<div class="p-3 rounded-2xl max-w-xs ${isMe ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-facebook-darkhover'}">${msg.content}</div>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }
}

// Send Message
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content || !activeChatUserId) return;

    const { error } = await supabase.from('messages').insert([
        { sender_id: currentUser.id, receiver_id: activeChatUserId, content: content }
    ]);

    if (!error) {
        input.value = '';
        loadMessages();
    }
}

// Realtime Subscription
function setupRealtimeMessages() {
    supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            if ((payload.new.sender_id === activeChatUserId && payload.new.receiver_id === currentUser.id) ||
                (payload.new.sender_id === currentUser.id && payload.new.receiver_id === activeChatUserId)) {
                loadMessages();
            }
        })
        .subscribe();
}

checkUser();
