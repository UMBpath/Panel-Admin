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
            email: email,
            password: password
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
            usersTableBody.innerHTML = '<tr><td colspan="6">Error cargando usuarios</td></tr>';
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
    if (!plan) return '📅';
    const p = plan.toLowerCase();
    if (p.includes('infinit')) return '♾️';
    if (p.includes('min')) return '⚡';
    if (p.includes('hora') || p.includes('hr')) return '🕒';
    if (p.includes('mes')) return '📆';
    return '📅';
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
        usersTableBody.innerHTML = '<tr><td colspan="6">No hay usuarios</td></tr>';
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
        html += '<tr class="infinite-section-header"><td colspan="6"><strong>Licencias Infinitas ♾️</strong></td></tr>';
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
                <td class="row-actions">
                    ${user.estado === 'activo'
                        ? `<button class="btn btn-danger" onclick="deactivateUser('${user.id}')">Desactivar</button>`
                        : `<button class="btn btn-secondary" onclick="activateUser('${user.id}')">Activar</button>`
                    }
                    <button class="btn btn-danger" onclick="deleteUser('${user.id}')">Borrar</button>
                </td>
            </tr>
        `).join('');
    }

    // Sección de licencias regulares
    if (regularLicenses.length > 0 && currentFilter !== 'infinite') {
        if (infiniteLicenses.length > 0 && currentFilter === 'all') {
            html += '<tr class="regular-section-header"><td colspan="6"><strong>Licencias Regulares</strong></td></tr>';
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
                <td class="row-actions">
                    ${user.estado === 'activo'
                        ? `<button class="btn btn-danger" onclick="deactivateUser('${user.id}')">Desactivar</button>`
                        : `<button class="btn btn-secondary" onclick="activateUser('${user.id}')">Activar</button>`
                    }
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

// ========================================================
// Selector de Duración
// ========================================================
const userDurationNum = document.getElementById('user-duration-num');
const userDurationUnit = document.getElementById('user-duration-unit');
const durationPreviewText = document.getElementById('duration-preview-text');
const presetChips = document.querySelectorAll('.preset-chip');

function getFormattedDuration() {
    const num = parseInt(userDurationNum?.value) || 1;
    const unit = userDurationUnit?.value || 'días';

    if (unit === 'minutos') {
        return num === 1 ? '1 minuto' : `${num} minutos`;
    } else if (unit === 'horas') {
        return num === 1 ? '1 hora' : `${num} horas`;
    } else if (unit === 'días') {
        return num === 1 ? '1 día' : `${num} días`;
    } else if (unit === 'meses') {
        return num === 1 ? '1 mes' : `${num} meses`;
    }
    return `${num} ${unit}`;
}

function updateDurationDisplay() {
    const formatted = getFormattedDuration();
    if (durationPreviewText) {
        durationPreviewText.textContent = formatted;
    }

    const currentNum = userDurationNum ? userDurationNum.value : '';
    const currentUnit = userDurationUnit ? userDurationUnit.value : '';

    presetChips.forEach(chip => {
        if (chip.dataset.num === currentNum && chip.dataset.unit === currentUnit) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// Event listeners para chips de selección rápida
presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const num = chip.dataset.num;
        const unit = chip.dataset.unit;
        const scheduleRequired = chip.dataset.schedule === 'true';

        if (userDurationNum) userDurationNum.value = num;
        if (userDurationUnit) userDurationUnit.value = unit;

        const requireScheduleCheckbox = document.getElementById('user-require-schedule');
        const scheduleGroup = document.getElementById('schedule-group');
        if (requireScheduleCheckbox && scheduleGroup) {
            requireScheduleCheckbox.checked = scheduleRequired;
            scheduleGroup.style.display = scheduleRequired ? 'block' : 'none';
        }

        updateDurationDisplay();
    });
});

if (userDurationNum) {
    userDurationNum.addEventListener('input', updateDurationDisplay);
}
if (userDurationUnit) {
    userDurationUnit.addEventListener('change', updateDurationDisplay);
}

// Crear usuario de la app
createUserBtn.addEventListener('click', () => {
    userModalForm.reset();
    if (userDurationNum) userDurationNum.value = 30;
    if (userDurationUnit) userDurationUnit.value = 'días';
    updateDurationDisplay();
    document.getElementById('user-require-schedule').checked = true;
    document.getElementById('schedule-group').style.display = 'block';
    generateUserScheduleTable();
    userModal.classList.remove('hidden');
});

// Toggle horario
document.getElementById('user-require-schedule').addEventListener('change', (e) => {
    const scheduleGroup = document.getElementById('schedule-group');
    if (e.target.checked) {
        scheduleGroup.style.display = 'block';
    } else {
        scheduleGroup.style.display = 'none';
    }
});

cancelUserModal.addEventListener('click', () => {
    userModal.classList.add('hidden');
    showMessage("user-modal-message", "", "");
});

// Limpiar horario de usuario
document.getElementById('clear-user-schedule').addEventListener('click', () => {
    clearUserScheduleGrid();
});

// Generar tabla de horarios para usuario
function generateUserScheduleTable() {
    const tbody = document.getElementById('user-schedule-body');
    tbody.innerHTML = '';

    const timeSlots = [
        '06 am - 07 am', '07 am - 08 am', '08 am - 09 am', '09 am - 10 am',
        '10 am - 11 am', '11 am - 12 pm', '12 pm - 01 pm', '01 pm - 02 pm',
        '02 pm - 03 pm', '03 pm - 04 pm', '04 pm - 05 pm', '05 pm - 06 pm',
        '06 pm - 07 pm', '07 pm - 08 pm', '08 pm - 09 pm', '09 pm - 10 pm',
        '10 pm - 11 pm', '11 pm - 12 am'
    ];

    const hours = [
        '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
        '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
    ];

    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    timeSlots.forEach((timeSlot, index) => {
        const row = document.createElement('tr');

        // Columna de hora
        const timeCell = document.createElement('td');
        timeCell.textContent = timeSlot;
        row.appendChild(timeCell);

        // Columnas de días
        days.forEach(day => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '--';
            input.dataset.day = day;
            input.dataset.time = hours[index];
            cell.appendChild(input);
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

// Obtener horario desde la tabla de usuario
function getUserScheduleFromGrid() {
    const schedule = {};
    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    days.forEach(day => {
        const inputs = document.querySelectorAll(`#user-schedule-body input[data-day="${day}"]`);
        const classes = [];

        inputs.forEach(input => {
            const value = input.value.trim();
            if (value && value !== '--') {
                const startHour = input.dataset.time;
                const hourNum = parseInt(startHour.split(':')[0]);
                const endHour = hourNum === 23 ? 0 : hourNum + 1;
                const endHourStr = endHour < 10 ? `0${endHour}:00` : `${endHour}:00`;

                classes.push({
                    hora: `${startHour} - ${endHourStr}`,
                    asignatura: value,
                    codigo: '',
                    duracion: 60
                });
            }
        });

        if (classes.length > 0) {
            schedule[day] = classes;
        }
    });

    return schedule;
}

// Limpiar la tabla de horarios de usuario
function clearUserScheduleGrid() {
    const inputs = document.querySelectorAll('#user-schedule-body input');
    inputs.forEach(input => {
        input.value = '';
    });
}

// Crear usuario de la app
userModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value.trim();
    const duration = getFormattedDuration();
    const requireSchedule = document.getElementById('user-require-schedule').checked;

    let horario = {};
    if (requireSchedule) {
        horario = getUserScheduleFromGrid();
        if (Object.keys(horario).length === 0) {
            showMessage("user-modal-message", "Debes configurar al menos un horario o desmarcar la opción", "error");
            return;
        }
    }

    showMessage("user-modal-message", "Creando usuario...", "");

    try {
        // Calcular fecha de expiración
        const now = new Date();
        let expiracion = new Date(now);

        if (duration.includes('minuto')) {
            const num = parseInt(duration) || 1;
            expiracion.setMinutes(now.getMinutes() + num);
        } else if (duration.includes('hora')) {
            const num = parseInt(duration) || 1;
            expiracion.setHours(now.getHours() + num);
        } else if (duration.includes('día') || duration.includes('dia')) {
            const num = parseInt(duration) || 1;
            expiracion.setDate(now.getDate() + num);
        } else if (duration.includes('mes')) {
            const num = parseInt(duration) || 1;
            expiracion.setMonth(now.getMonth() + num);
        } else {
            expiracion.setDate(now.getDate() + 30);
        }

        console.log("Insertando usuario directamente:", {
            usuario: username,
            password: password,
            plan: duration,
            fecha_expiracion: expiracion.toISOString(),
            horario_activacion: horario,
            estado: 'activo'
        });

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

        console.log("Respuesta de RPC:", { data, error });

        if (error) {
            console.error("Error creando usuario:", error);
            let msg = error.message || "Error al crear usuario";
            if (msg.includes("column \"plan\"") || msg.includes("plan")) {
                msg = "Error: Falta la columna 'plan' en la base de datos de Supabase. Ejecuta el script SQL correspondiente.";
            }
            showMessage("user-modal-message", msg, "error");
            return;
        }

        if (!data) {
            console.error("No se recibió respuesta del servidor");
            showMessage("user-modal-message", "No se recibió respuesta del servidor", "error");
            return;
        }

        console.log("Usuario creado con éxito:", data);
        showMessage("user-modal-message", "Usuario creado exitosamente", "success");
        userModalForm.reset();
        clearUserScheduleGrid();

        setTimeout(() => {
            userModal.classList.add('hidden');
            showMessage("user-modal-message", "", "");
            console.log("Recargando usuarios...");
            loadUsers();
        }, 1500);

    } catch (error) {
        console.error("Error en crear usuario:", error);
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
