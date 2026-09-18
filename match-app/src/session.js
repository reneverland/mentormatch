import { ref } from "vue";

const STUDENT_KEY = "imba-match-student-token";
const ADMIN_KEY = "imba-match-admin-token";

function read(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (err) {
    return "";
  }
}

function write(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch (err) {
    /* 隐私模式下忽略，仅本次会话有效 */
  }
}

export const studentToken = ref(read(STUDENT_KEY));
export const adminToken = ref(read(ADMIN_KEY));

export function setStudentToken(value) {
  studentToken.value = value || "";
  write(STUDENT_KEY, studentToken.value);
}

export function setAdminToken(value) {
  adminToken.value = value || "";
  write(ADMIN_KEY, adminToken.value);
}
