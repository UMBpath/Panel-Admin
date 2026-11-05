// Configuración de Supabase - CAMBIAR POR TU NUEVO PROYECTO
const SUPABASE_URL = "https://lcrctcaogoyimtjmdqzu.supabase.co";
const SUPABASE_KEY = "sb_publishable_gQeoJvYho2FGdOX-JqXJlQ_6qJDzxV-";

// Inicializar Supabase
let supabaseClient;

try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase inicializado correctamente");
} catch (error) {
    console.error("Error inicializando Supabase:", error);
    showMessage("login-message", "Error cargando Supabase. Por favor recarga la página.", "error");
}

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const usersBtn = document.getElementById('users-btn');
const createUserBtn = document.getElementById('create-user-btn');
const searchInput = document.getElementById('search-input');
const usersTableBody = document.getElementById('users-table-body');
const userModal = document.getElementById('user-modal');
const userModalForm = document.getElementById('user-modal-form');
const cancelUserModal = document.getElementById('cancel-user-modal');

let users = [];
let currentFilter = 'infinite';

// Mostrar mensajes
function showMessage(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = type ? `message ${type}` : 'message';
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Intentando login...");

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    showMessage("login-message", "Iniciando sesión...", "");

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error("Error de login:", error);
            showMessage("login-message", error.message || "Error al iniciar sesión", "error");
            return;
        }

        console.log("Login exitoso:", data);

        // Verificar si es operador
        const isOperator = await checkOperator(email);
        if (!isOperator) {
            await supabaseClient.auth.signOut();
            showMessage("login-message", "No tienes permisos de administrador", "error");
            return;
        }

        // Mostrar dashboard
        userEmail.textContent = email;
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        showMessage("login-message", "", "");

        // Cargar usuarios
        await loadUsers();

        // Mostrar solo tarjeta de licencias infinitas por defecto
        document.getElementById('infinite-stat-card').style.display = 'block';
        document.getElementById('stat-total-card').style.display = 'none';
        document.getElementById('stat-active-card').style.display = 'none';
        document.getElementById('stat-inactive-card').style.display = 'none';
        document.querySelector('.stats-row').style.gridTemplateColumns = '1fr';

    } catch (error) {
        console.error("Error en login:", error);
        showMessage("login-message", "Error de conexión. Intenta nuevamente.", "error");
    }
});

// Verificar si es operador
async function checkOperator(email) {
    try {
        const { data, error } = await supabaseClient
            .from('operadores')
            .select('email')
            .eq('email', email)
            .single();

        if (error) {
            console.error("Error verificando operador:", error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error("Error en checkOperator:", error);
        return false;
    }
}

// Logout
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginForm.reset();
});

// Cargar usuarios de la app
async function loadUsers() {
    try {
        console.log("Cargando usuarios desde usuarios_app...");
        const { data, error } = await supabaseClient
            .from('usuarios_app')
            .select('*')
            .order('created_at', { ascending: false });

        console.log("Respuesta de loadUsers:", { data, error });

        if (error) {
            console.error("Error cargando usuarios:", error);
            usersTableBody.innerHTML = '<tr><td colspan="7">Error cargando usuarios</td></tr>';
            return;
        }

        users = data || [];
        console.log("Usuarios cargados:", users);
        renderUsers();
        updateStats();

    } catch (error) {
        console.error("Error en loadUsers:", error);
    }
}

// Actualizar estadísticas
function updateStats() {
    const total = users.length;
    const active = users.filter(u => u.estado === 'activo').length;
    const inactive = users.filter(u => u.estado === 'inactivo').length;
    const infinite = users.filter(u => u.plan?.toLowerCase().includes('infinit')).length;
    const infiniteActive = users.filter(u => u.plan?.toLowerCase().includes('infinit') && u.estado === 'activo').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-inactive').textContent = inactive;
    document.getElementById('stat-infinite').textContent = infiniteActive;
}

// Helpers de Plan
function getPlanBadgeClass(plan) {
    if (!plan) return 'badge-plan';
    const p = plan.toLowerCase();
    if (p.includes('infinit')) return 'badge-infinite';
    if (p.includes('min')) return 'badge-trial';
    if (p.includes('hora') || p.includes('hr')) return 'badge-hour';
    if (p.includes('mes')) return 'badge-month';
    return 'badge-plan';
}

function getPlanIcon(plan) {
    if (!plan) return '📄';
    const p = plan.toLowerCase();
    if (p.includes('infinit')) return '🏆';
    if (p.includes('min')) return '⏰';
    if (p.includes('hora') || p.includes('hr')) return '⏱️';
    if (p.includes('mes')) return '📅';
    return '📄';
}

// Renderizar usuarios
function renderUsers() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredUsers = users.filter(user =>
        user.usuario?.toLowerCase().includes(searchTerm)
    );

    // Aplicar filtro de pestaña
    if (currentFilter === 'infinite') {
        filteredUsers = filteredUsers.filter(user =>
            user.plan?.toLowerCase().includes('infinit')
        );
    } else if (currentFilter === 'regular') {
        filteredUsers = filteredUsers.filter(user =>
            !user.plan?.toLowerCase().includes('infinit')
        );
    }

    if (filteredUsers.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="7">No hay usuarios</td></tr>';
        return;
    }

    // Separar licencias infinitas del resto (solo cuando filtro es 'all')
    const infiniteLicenses = filteredUsers.filter(user =>
        user.plan?.toLowerCase().includes('infinit')
    );
    const regularLicenses = filteredUsers.filter(user =>
        !user.plan?.toLowerCase().includes('infinit')
    );

    let html = '';

    // Sección de licencias infinitas
    if (infiniteLicenses.length > 0 && currentFilter !== 'regular') {
        html += '<tr class="infinite-section-header"><td colspan="7"><strong>Licencias Infinitas ♾️</strong></td></tr>';
        html += infiniteLicenses.map(user => `
            <tr class="infinite-row">
                <td>
                    <strong>${escapeHtml(user.usuario || '')}</strong>
                </td>
                <td>
                    <span class="badge ${getPlanBadgeClass(user.plan)}">
                        ${getPlanIcon(user.plan)} ${escapeHtml(user.plan || '30 días')}
                    </span>
                </td>
                <td>${formatDate(user.fecha_expiracion)}</td>
                <td>
                    ${user.horario_activacion && Object.keys(user.horario_activacion).length > 0
                ? formatScheduleHuman(user.horario_activacion)
                : '<span class="badge inactive">Sin horario</span>'}
                </td>
                <td>
                    <span class="badge ${user.estado === 'activo' ? 'active' : 'inactive'}">
                        ${user.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    ${user.telegram_chat_id
                ? `<span class="badge active" title="Chat ID: ${user.telegram_chat_id}">📱 Conectado</span>`
                : `<span class="badge inactive">No vinculado</span>`}
                </td>
                <td class="row-actions">
                    ${user.estado === 'activo'
                ? `<button class="btn btn-danger" onclick="deactivateUser('${user.id}')">Desactivar</button>`
                : `<button class="btn btn-secondary" onclick="activateUser('${user.id}')">Activar</button>`}
                                <button class="btn btn-danger" onclick="deleteUser('${user.id}')">Borrar</button>
                </td>
            </tr>
        `).join('');
    }

    // Sección de licencias regulares
    if (regularLicenses.length > 0 && currentFilter !== 'infinite') {
        if (infiniteLicenses.length > 0 && currentFilter === 'all') {
            html += '<tr class="regular-section-header"><td colspan="7"><strong>Licencias Regulares</strong></td></tr>';
        }
        html += regularLicenses.map(user => `
            <tr>
                <td>
                    <strong>${escapeHtml(user.usuario || '')}</strong>
                </td>
                <td>
                    <span class="badge ${getPlanBadgeClass(user.plan)}">
                        ${getPlanIcon(user.plan)} ${escapeHtml(user.plan || '30 días')}
                    </span>
                </td>
                <td>${formatDate(user.fecha_expiracion)}</td>
                <td>
                    ${user.horario_activacion && Object.keys(user.horario_activacion).length > 0
                ? formatScheduleHuman(user.horario_activacion)
                : '<span class="badge inactive">Sin horario</span>'}
                </td>
                <td>
                    <span class="badge ${user.estado === 'activo' ? 'active' : 'inactive'}">
                        ${user.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    ${user.telegram_chat_id
                ? `<span class="badge active" title="Chat ID: ${user.telegram_chat_id}">📱 Conectado</span>`
                : `<span class="badge inactive">No vinculado</span>`}
                </td>
                <td class="row-actions">
                    ${user.estado === 'activo'
                ? `<button class="btn btn-danger" onclick="deactivateUser('${user.id}')">Desactivar</button>`
                : `<button class="btn btn-secondary" onclick="activateUser('${user.id}')">Activar</button>`}
                                <button class="btn btn-danger" onclick="deleteUser('${user.id}')">Borrar</button>
                </td>
            </tr>
        `).join('');
    }

    usersTableBody.innerHTML = html;
}

// Formatear fecha
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-PE') + ' ' + date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateStr;
    }
}

// Formatear horario para humanos
function formatScheduleHuman(schedule) {
    if (!schedule) return '—';

    // CASO 1: Quizes / Exámenes por fecha específica
    if (schedule.quizes && Array.isArray(schedule.quizes) && schedule.quizes.length > 0) {
        let result = '';
        schedule.quizes.forEach(q => {
            const fechaStr = formatQuizDate(q.fecha);
            result += `<strong>📅 ${fechaStr}:</strong> ${q.hora_inicio} - ${q.hora_fin}<br>`;
            result += `<small style="color:#d35400;">• Activo: ${q.ventana_inicio} - ${q.ventana_fin}</small>`;
            if (q.nombre) result += ` <span style="color:#666;">(${escapeHtml(q.nombre)})</span>`;
            result += `<br>`;
        });
        return result || '—';
    }

    // CASO 2: Formato semanal clásico
    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    let result = '';

    days.forEach(day => {
        if (schedule[day] && schedule[day].length > 0) {
            result += `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong><br>`;
            schedule[day].forEach(cls => {
                result += `  • ${cls.hora}: ${cls.asignatura}<br>`;
            });
        }
    });

    return result || '—';
}

function formatQuizDate(dateStr) {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const diaSemana = dias[dt.getDay()];
        return `${diaSemana} ${d}/${m}/${y}`;
    } catch {
        return dateStr;
    }
}

// Escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Buscar
searchInput.addEventListener('input', () => {
    renderUsers();
});

// Filtros
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;

        // Mostrar/ocultar tarjetas de estadísticas
        const infiniteStatCard = document.getElementById('infinite-stat-card');
        const totalStatCard = document.getElementById('stat-total-card');
        const activeStatCard = document.getElementById('stat-active-card');
        const inactiveStatCard = document.getElementById('stat-inactive-card');

        if (currentFilter === 'infinite') {
            infiniteStatCard.style.display = 'block';
            totalStatCard.style.display = 'none';
            activeStatCard.style.display = 'none';
            inactiveStatCard.style.display = 'none';
            document.querySelector('.stats-row').style.gridTemplateColumns = '1fr';
        } else {
            infiniteStatCard.style.display = 'none';
            totalStatCard.style.display = 'block';
            activeStatCard.style.display = 'block';
            inactiveStatCard.style.display = 'block';
            document.querySelector('.stats-row').style.gridTemplateColumns = 'repeat(4, 1fr)';
        }

        renderUsers();
    });
});

// ========================================
// NUEVO SISTEMA DE LICENCIAS (2 tipos)
// ========================================

let quizesList = []; // Array de quizes programados

// --- Switching de tipo de licencia ---
document.querySelectorAll('input[name="license-type-radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const type = radio.value;
        document.querySelectorAll('.license-type-card').forEach(c => c.classList.remove('active'));
        radio.closest('.license-type-card').classList.add('active');

        if (type === 'test') {
            document.getElementById('test-info-box').classList.remove('hidden');
            document.getElementById('schedule-quizzes-section').classList.add('hidden');
        } else {
            document.getElementById('test-info-box').classList.add('hidden');
            document.getElementById('schedule-quizzes-section').classList.remove('hidden');
            generateScheduleTable();
        }
    });
});

// --- Generar tabla de horario ---
function generateScheduleTable() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const hours = [];
    for (let h = 6; h <= 23; h++) {
        const period = h < 12 ? 'am' : 'pm';
        const hour12 = h > 12 ? h - 12 : h;
        const nextHour = h + 1;
        const nextPeriod = nextHour < 12 ? 'am' : 'pm';
        const nextHour12 = nextHour > 12 ? nextHour - 12 : nextHour;
        hours.push(`${String(hour12).padStart(2, '0')} ${period} - ${String(nextHour12).padStart(2, '0')} ${nextPeriod}`);
    }

    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

    hours.forEach(hour => {
        const row = document.createElement('tr');
        const hourCell = document.createElement('td');
        hourCell.textContent = hour;
        row.appendChild(hourCell);

        days.forEach(day => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '--';
            input.dataset.day = day;
            input.dataset.hour = hour;
            cell.appendChild(input);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

// --- Limpiar horario ---
document.getElementById('btn-clear-schedule')?.addEventListener('click', () => {
    const inputs = document.querySelectorAll('#schedule-table input');
    inputs.forEach(input => input.value = '');
    quizesList = [];
    renderQuizList();
});

// --- Generar horario semanal ---
document.getElementById('btn-generate-quizzes')?.addEventListener('click', () => {
    const inputs = document.querySelectorAll('#schedule-table input');
    const scheduleData = {};

    // Recopilar datos del horario
    inputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            const day = input.dataset.day;
            const hour = input.dataset.hour;
            if (!scheduleData[day]) {
                scheduleData[day] = [];
            }
            scheduleData[day].push({
                hour,
                materia: value
            });
        }
    });

    if (Object.keys(scheduleData).length === 0) {
        alert('Llena al menos una celda de la tabla de horario');
        return;
    }

    // Guardar horario semanal en formato original (no generar quizzes por fecha)
    window.scheduleData = scheduleData;

    // Mostrar resumen del horario
    quizesList = [];
    let totalCount = 0;

    const dayMapping = {
        'lunes': 'Lunes',
        'martes': 'Martes',
        'miercoles': 'Miércoles',
        'jueves': 'Jueves',
        'viernes': 'Viernes',
        'sabado': 'Sábado'
    };

    for (const [dayName, classes] of Object.entries(scheduleData)) {
        classes.forEach(cls => {
            totalCount++;
            quizesList.push({
                day: dayMapping[dayName],
                hour: cls.hour,
                materia: cls.materia
            });
        });
    }

    renderQuizList();
});

// --- Renderizar lista de horario ---
function renderQuizList() {
    const list = document.getElementById('quizzes-list');
    const noMsg = document.getElementById('no-quizzes-msg');
    const count = document.getElementById('quizzes-count');

    if (count) count.textContent = quizesList.length;
    if (!list) return;

    list.querySelectorAll('.quiz-card-item').forEach(c => c.remove());

    if (quizesList.length === 0) {
        if (noMsg) noMsg.style.display = 'block';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';

    quizesList.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'quiz-card-item';
        card.innerHTML = `
            <div class="quiz-card-info">
                <span class="quiz-card-title">${q.day}: ${escapeHtml(q.materia)}</span>
                <span class="quiz-card-time">🕐 ${q.hour}</span>
            </div>
            <button class="btn-remove-quiz" onclick="removeQuiz(${index})">✕ Quitar</button>
        `;
        list.appendChild(card);
    });
}

window.removeQuiz = (index) => {
    quizesList.splice(index, 1);
    renderQuizList();
};

// --- Abrir modal (adaptado para reiniciar modo de programación) ---
createUserBtn.addEventListener('click', () => {
    userModalForm.reset();
    quizesList = [];
    renderQuizList();

    // Resetear al tipo 'test' por defecto
    const radioTest = document.getElementById('radio-type-test');
    const cardTest = document.getElementById('card-type-test');
    const cardSchedule = document.getElementById('card-type-schedule');
    const testBox = document.getElementById('test-info-box');
    const scheduleSection = document.getElementById('schedule-quizzes-section');

    if (radioTest) radioTest.checked = true;
    if (cardTest) cardTest.classList.add('active');
    if (cardSchedule) cardSchedule.classList.remove('active');
    if (testBox) testBox.classList.remove('hidden');
    if (scheduleSection) scheduleSection.classList.add('hidden');

    userModal.classList.remove('hidden');
});

cancelUserModal.addEventListener('click', () => {
    userModal.classList.add('hidden');
    showMessage("user-modal-message", "", "");
});

// --- Submit: crear usuario ---
userModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value.trim();

    if (!username || !password) {
        showMessage("user-modal-message", "Completa usuario y contraseña", "error");
        return;
    }

    const licenseType = document.querySelector('input[name="license-type-radio"]:checked')?.value || 'test';

    let horario = {};
    let duration = '';
    let expiracion = new Date();

    if (licenseType === 'test') {
        // Prueba 15 minutos — sin horario
        duration = '15 minutos';
        expiracion = new Date(Date.now() + 15 * 60 * 1000);
        horario = {};

    } else {
        // Horario de clases semanal
        if (!window.scheduleData || Object.keys(window.scheduleData).length === 0) {
            showMessage("user-modal-message", "Genera el horario antes de crear la licencia", "error");
            return;
        }

        duration = 'Horario de clases semanal';

        // La licencia expira en 1 año (horario semanal indefinido)
        expiracion = new Date();
        expiracion.setFullYear(expiracion.getFullYear() + 1);

        // Convertir scheduleData al formato original de horario
        const dayMapping = {
            'lunes': 'lunes',
            'martes': 'martes',
            'miercoles': 'miércoles',
            'jueves': 'jueves',
            'viernes': 'viernes',
            'sabado': 'sábado'
        };

        horario = {};

        for (const [dayName, classes] of Object.entries(window.scheduleData)) {
            const dayKey = dayMapping[dayName];
            if (!dayKey) continue; // Saltar si no hay mapeo
            horario[dayKey] = classes.map(cls => {
                const [startStr, endStr] = cls.hour.split(' - ');
                const [startHour, startPeriod] = startStr.split(' ');
                const [endHour, endPeriod] = endStr.split(' ');

                // Convertir a formato 24h
                let sh = parseInt(startHour);
                if (startPeriod === 'pm' && sh !== 12) sh += 12;
                if (startPeriod === 'am' && sh === 12) sh = 0;

                let eh = parseInt(endHour);
                if (endPeriod === 'pm' && eh !== 12) eh += 12;
                if (endPeriod === 'am' && eh === 12) eh = 0;

                return {
                    hora: `${String(sh).padStart(2, '0')}:00 - ${String(eh).padStart(2, '0')}:00`,
                    asignatura: cls.materia
                };
            });
        }

        horario = {};

        for (const [dayName, classes] of Object.entries(window.scheduleData)) {
            const dayKey = dayMapping[dayName];
            horario[dayKey] = classes.map(cls => {
                const [startStr, endStr] = cls.hour.split(' - ');
                const [startHour, startPeriod] = startStr.split(' ');
                const [endHour, endPeriod] = endStr.split(' ');

                // Convertir a formato 24h
                let sh = parseInt(startHour);
                if (startPeriod === 'pm' && sh !== 12) sh += 12;
                if (startPeriod === 'am' && sh === 12) sh = 0;

                let eh = parseInt(endHour);
                if (endPeriod === 'pm' && eh !== 12) eh += 12;
                if (endPeriod === 'am' && eh === 12) eh = 0;

                return {
                    hora: `${String(sh).padStart(2, '0')}:00 - ${String(eh).padStart(2, '0')}:00`,
                    asignatura: cls.materia
                };
            });
        }
    }

    showMessage("user-modal-message", "Creando usuario...", "");

    try {
        const { data, error } = await supabaseClient
            .from('usuarios_app')
            .insert({
                usuario: username,
                password: password,
                plan: duration,
                fecha_expiracion: expiracion.toISOString(),
                horario_activacion: horario,
                estado: 'activo'
            })
            .select()
            .single();

        if (error) {
            console.error("Error creando usuario:", error);
            showMessage("user-modal-message", error.message || "Error al crear usuario", "error");
            return;
        }

        if (!data) {
            showMessage("user-modal-message", "No se recibió respuesta del servidor", "error");
            return;
        }

        showMessage("user-modal-message", "✅ Usuario creado exitosamente", "success");
        userModalForm.reset();
        quizesList = [];
        renderQuizList();

        setTimeout(() => {
            userModal.classList.add('hidden');
            showMessage("user-modal-message", "", "");
            loadUsers();
        }, 1500);

    } catch (error) {
        console.error("Error:", error);
        showMessage("user-modal-message", "Error de conexión: " + error.message, "error");
    }
});

// Acciones de usuarios
window.deactivateUser = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return;

    try {
        const { error } = await supabaseClient
            .from('usuarios_app')
            .update({ estado: 'inactivo' })
            .eq('id', id);

        if (error) {
            alert(error.message);
            return;
        }

        await loadUsers();
    } catch (error) {
        console.error("Error desactivando usuario:", error);
        alert("Error de conexión");
    }
};

window.activateUser = async (id) => {
    try {
        const { error } = await supabaseClient
            .from('usuarios_app')
            .update({ estado: 'activo' })
            .eq('id', id);

        if (error) {
            alert(error.message);
            return;
        }

        await loadUsers();
    } catch (error) {
        console.error("Error activando usuario:", error);
        alert("Error de conexión");
    }
};

window.deleteUser = async (id) => {
    const user = users.find(u => u.id === id);
    if (!confirm(`¿Borrar usuario ${user?.usuario || id}?`)) return;

    try {
        const { error } = await supabaseClient
            .from('usuarios_app')
            .delete()
            .eq('id', id);

        if (error) {
            alert(error.message);
            return;
        }

        await loadUsers();
    } catch (error) {
        console.error("Error borrando usuario:", error);
        alert("Error de conexión");
    }
};

// Verificar sesión al cargar
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        const isOperator = await checkOperator(session.user.email);
        if (isOperator) {
            userEmail.textContent = session.user.email;
            loginScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            await loadUsers();
        }
    }
});
