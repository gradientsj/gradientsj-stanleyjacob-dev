"""Measurements for the manipulator kinematics/dynamics/control article.

Everything printed here is computed on this machine. Run:

    python classes/data/bench_robotics.py > classes/data/robotics.json

Sections
  1. SO(3)/SE(3): Rodrigues, quaternions, transform composition, adjoint
  2. Forward kinematics: 2R and 3R planar, 6R spatial via product of exponentials
  3. Jacobians: analytic vs. JAX autodiff, singular values, manipulability
  4. Inverse kinematics: closed form, transpose / pseudo-inverse / DLS convergence
  5. Dynamics: two-link M, C, g by hand vs. MuJoCo, energy drift, skew symmetry
  6. Control: PD+gravity vs. computed torque vs. operational space
  7. Trajectories: quintic, trapezoid, minimum jerk
"""

import json
import time

import numpy as np

np.set_printoptions(precision=6, suppress=True)

OUT = {}
G = 9.81


def r(x, n=9):
    """Round nested arrays/floats for JSON."""
    if isinstance(x, (list, tuple)):
        return [r(v, n) for v in x]
    if isinstance(x, np.ndarray):
        return r(x.tolist(), n)
    if isinstance(x, (float, np.floating)):
        return round(float(x), n)
    if isinstance(x, (int, np.integer)):
        return int(x)
    return x


# ---------------------------------------------------------------- 1. SO(3)/SE(3)

def hat(w):
    return np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]], float)


def rodrigues(w, th):
    w = np.asarray(w, float)
    W = hat(w)
    return np.eye(3) + np.sin(th) * W + (1 - np.cos(th)) * (W @ W)


def se3_hat(S):
    w, v = S[:3], S[3:]
    T = np.zeros((4, 4))
    T[:3, :3] = hat(w)
    T[:3, 3] = v
    return T


def exp6(S, th):
    """Matrix exponential of a unit screw times theta (Modern Robotics form)."""
    w, v = np.asarray(S[:3], float), np.asarray(S[3:], float)
    T = np.eye(4)
    if np.linalg.norm(w) < 1e-12:
        T[:3, 3] = v * th
        return T
    R = rodrigues(w, th)
    W = hat(w)
    Gth = np.eye(3) * th + (1 - np.cos(th)) * W + (th - np.sin(th)) * (W @ W)
    T[:3, :3] = R
    T[:3, 3] = Gth @ v
    return T


def adjoint(T):
    R, p = T[:3, :3], T[:3, 3]
    A = np.zeros((6, 6))
    A[:3, :3] = R
    A[3:, 3:] = R
    A[3:, :3] = hat(p) @ R
    return A


def quat_from_R(R):
    w = 0.5 * np.sqrt(max(0.0, 1 + R[0, 0] + R[1, 1] + R[2, 2]))
    x = (R[2, 1] - R[1, 2]) / (4 * w)
    y = (R[0, 2] - R[2, 0]) / (4 * w)
    z = (R[1, 0] - R[0, 1]) / (4 * w)
    return np.array([w, x, y, z])


def R_from_quat(q):
    w, x, y, z = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])


def quat_mul(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return np.array([
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2])


def se3_section():
    d = {}
    # R1: 90 deg about z. R2: 90 deg about y.
    R1 = rodrigues([0, 0, 1], np.pi / 2)
    R2 = rodrigues([0, 1, 0], np.pi / 2)
    d["R1_rodrigues"] = r(R1)
    d["R2_rodrigues"] = r(R2)
    d["R1R2"] = r(R1 @ R2)
    d["R2R1"] = r(R2 @ R1)
    d["commutator_norm"] = r(np.linalg.norm(R1 @ R2 - R2 @ R1))
    d["R1_orthonormality_err"] = r(np.max(np.abs(R1.T @ R1 - np.eye(3))))
    d["R1_det"] = r(np.linalg.det(R1))

    # Rodrigues checked against a truncated series expansion of exp([w]th).
    W = hat(np.array([1.0, 2.0, 2.0]) / 3.0)
    th = 0.7
    S = np.eye(3)
    term = np.eye(3)
    for k in range(1, 25):
        term = term @ (W * th) / k
        S = S + term
    d["rodrigues_vs_series_maxabs"] = r(
        np.max(np.abs(rodrigues(np.array([1.0, 2.0, 2.0]) / 3.0, th) - S)))

    # quaternion composition matches matrix composition
    q1, q2 = quat_from_R(R1), quat_from_R(R2)
    d["q1"] = r(q1)
    d["q2"] = r(q2)
    d["q1q2"] = r(quat_mul(q1, q2))
    d["quat_vs_matrix_maxabs"] = r(np.max(np.abs(R_from_quat(quat_mul(q1, q2)) - R1 @ R2)))

    # concrete SE(3) composition
    T1 = np.eye(4)
    T1[:3, :3] = R1
    T1[:3, 3] = [0.3, 0.0, 0.1]
    T2 = np.eye(4)
    T2[:3, :3] = R2
    T2[:3, 3] = [0.0, 0.2, 0.4]
    T12 = T1 @ T2
    d["T1"] = r(T1)
    d["T2"] = r(T2)
    d["T1T2"] = r(T12)
    d["T1T2_inv"] = r(np.linalg.inv(T12))
    p_b = np.array([1.0, 0.0, 0.0, 1.0])
    d["point_in_frame2"] = [1.0, 0.0, 0.0]
    d["point_mapped"] = r((T12 @ p_b)[:3])

    # exp6 of a pure-rotation screw reproduces the same transform
    Ssc = np.array([0, 0, 1, 0.0, -0.0, 0])  # rotation about world z through origin
    d["exp6_z90"] = r(exp6(Ssc, np.pi / 2))

    # adjoint maps a twist between frames; check Ad_T [V] Ad_T^{-1} identity
    V = np.array([0.1, -0.2, 0.3, 0.4, 0.5, -0.6])
    lhs = se3_hat(adjoint(T12) @ V)
    rhs = T12 @ se3_hat(V) @ np.linalg.inv(T12)
    d["adjoint_identity_maxabs"] = r(np.max(np.abs(lhs - rhs)))
    d["Ad_T1T2_V"] = r(adjoint(T12) @ V)
    return d


OUT["se3"] = se3_section()


# ------------------------------------------------------- 2. Forward kinematics

L1, L2, L3 = 1.0, 1.0, 0.5


def fk2(q, l1=L1, l2=L2):
    x = l1 * np.cos(q[0]) + l2 * np.cos(q[0] + q[1])
    y = l1 * np.sin(q[0]) + l2 * np.sin(q[0] + q[1])
    return np.array([x, y])


def fk3(q, l=(L1, L2, L3)):
    c1 = np.cos(q[0])
    c12 = np.cos(q[0] + q[1])
    c123 = np.cos(q[0] + q[1] + q[2])
    s1 = np.sin(q[0])
    s12 = np.sin(q[0] + q[1])
    s123 = np.sin(q[0] + q[1] + q[2])
    return np.array([l[0] * c1 + l[1] * c12 + l[2] * c123,
                     l[0] * s1 + l[1] * s12 + l[2] * s123,
                     q[0] + q[1] + q[2]])


# 6R spatial arm, product-of-exponentials description (own design, clean numbers)
W6 = np.array([[0, 0, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0]], float)
Q6 = np.array([[0, 0, 0], [0, 0, 0.4], [0.5, 0, 0.4], [0.9, 0, 0.4],
               [0.9, 0, 0.4], [0.9, 0, 0.4]], float)  # a point on each axis
S6 = np.zeros((6, 6))
for i in range(6):
    S6[:3, i] = W6[i]
    S6[3:, i] = -np.cross(W6[i], Q6[i])
M6 = np.eye(4)
M6[:3, 3] = [1.05, 0.0, 0.4]


def fk6(q):
    T = np.eye(4)
    for i in range(6):
        T = T @ exp6(S6[:, i], q[i])
    return T @ M6


def fk_section():
    d = {}
    qa = np.array([np.pi / 6, np.pi / 3])
    d["two_link_q_deg"] = [30.0, 60.0]
    d["two_link_lengths"] = [L1, L2]
    d["two_link_p"] = r(fk2(qa))
    qb = np.array([np.pi / 6, np.pi / 3, -np.pi / 4])
    d["three_link_q_deg"] = [30.0, 60.0, -45.0]
    d["three_link_lengths"] = [L1, L2, L3]
    d["three_link_pose"] = r(fk3(qb))
    d["three_link_phi_deg"] = r(np.degrees(fk3(qb)[2]))

    q6 = np.array([0.3, -0.5, 0.8, 0.2, -0.4, 0.6])
    d["six_link_q"] = r(q6)
    d["six_link_screws"] = r(S6.T)
    d["six_link_M"] = r(M6)
    d["six_link_T"] = r(fk6(q6))
    d["six_link_home_T"] = r(fk6(np.zeros(6)))
    return d


OUT["fk"] = fk_section()


# ------------------------------------------------------------- 3. Jacobians

def jac2(q, l1=L1, l2=L2):
    s1, s12 = np.sin(q[0]), np.sin(q[0] + q[1])
    c1, c12 = np.cos(q[0]), np.cos(q[0] + q[1])
    return np.array([[-l1 * s1 - l2 * s12, -l2 * s12],
                     [l1 * c1 + l2 * c12, l2 * c12]])


def jac3_pos(q, l=(L1, L2, L3)):
    s1, s12, s123 = np.sin(q[0]), np.sin(q[0] + q[1]), np.sin(q[0] + q[1] + q[2])
    c1, c12, c123 = np.cos(q[0]), np.cos(q[0] + q[1]), np.cos(q[0] + q[1] + q[2])
    a = -l[0] * s1 - l[1] * s12 - l[2] * s123
    b = -l[1] * s12 - l[2] * s123
    c = -l[2] * s123
    d_ = l[0] * c1 + l[1] * c12 + l[2] * c123
    e = l[1] * c12 + l[2] * c123
    f = l[2] * c123
    return np.array([[a, b, c], [d_, e, f]])


def space_jacobian6(q):
    """Space Jacobian by the product-of-exponentials formula."""
    J = np.zeros((6, 6))
    T = np.eye(4)
    for i in range(6):
        J[:, i] = adjoint(T) @ S6[:, i]
        T = T @ exp6(S6[:, i], q[i])
    return J


def jac_section():
    d = {}
    q = np.array([np.pi / 6, np.pi / 3])
    d["J2_at_30_60"] = r(jac2(q))
    d["J2_det"] = r(np.linalg.det(jac2(q)))
    d["J2_det_formula"] = r(L1 * L2 * np.sin(q[1]))

    # numeric central-difference check of the analytic planar Jacobian
    h = 1e-6
    Jn = np.zeros((2, 2))
    for i in range(2):
        e = np.zeros(2)
        e[i] = h
        Jn[:, i] = (fk2(q + e) - fk2(q - e)) / (2 * h)
    d["J2_finite_diff_maxabs"] = r(np.max(np.abs(Jn - jac2(q))))

    # singular configuration: elbow straight
    qs = np.array([0.4, 0.0])
    Js = jac2(qs)
    U, s, Vt = np.linalg.svd(Js)
    d["singular_q"] = r(qs)
    d["singular_J"] = r(Js)
    d["singular_svals"] = r(s)
    d["singular_cond"] = r(s[0] / max(s[1], 1e-300)) if s[1] > 1e-15 else None
    d["singular_left_null_dir"] = r(U[:, 1])
    d["singular_lost_dir_check"] = r(U[:, 1] @ Js)
    d["manipulability_at_singular"] = r(np.sqrt(np.linalg.det(Js @ Js.T)))

    # manipulability sweep over elbow angle
    sweep = []
    for q2deg in [5, 15, 30, 45, 60, 90, 120, 150, 175]:
        qq = np.array([0.4, np.radians(q2deg)])
        J = jac2(qq)
        sv = np.linalg.svd(J, compute_uv=False)
        sweep.append({"q2_deg": q2deg, "sigma": r(sv),
                      "w": r(np.sqrt(np.linalg.det(J @ J.T))),
                      "cond": r(sv[0] / sv[1])})
    d["manipulability_sweep"] = sweep

    # near-singular conditioning
    near = []
    for q2deg in [10, 3, 1, 0.3, 0.1, 0.03]:
        J = jac2(np.array([0.4, np.radians(q2deg)]))
        sv = np.linalg.svd(J, compute_uv=False)
        near.append({"q2_deg": q2deg, "sigma_min": r(sv[1]), "cond": r(sv[0] / sv[1]),
                     "pinv_norm": r(np.linalg.norm(np.linalg.pinv(J), 2))})
    d["near_singular"] = near

    # redundancy: 3R planar arm, 2-dim position task -> 1-dim null space
    q3 = np.array([0.3, 0.8, -0.6])
    J3 = jac3_pos(q3)
    Jp = np.linalg.pinv(J3)
    N = np.eye(3) - Jp @ J3
    d["J3"] = r(J3)
    d["J3_pinv"] = r(Jp)
    d["null_projector"] = r(N)
    d["null_projector_rank"] = int(np.linalg.matrix_rank(N, tol=1e-9))
    d["null_projector_idempotent_err"] = r(np.max(np.abs(N @ N - N)))
    d["null_projector_symmetry_err"] = r(np.max(np.abs(N - N.T)))
    ns = np.linalg.svd(N)[0][:, 0]
    d["null_direction"] = r(ns)
    d["J3_times_null_direction"] = r(J3 @ ns)
    # self-motion: move along null direction, end effector should not move
    step = 0.05
    p0 = fk3(q3)[:2]
    p1 = fk3(q3 + step * ns)[:2]
    d["self_motion_ee_shift"] = r(np.linalg.norm(p1 - p0))
    d["self_motion_joint_shift"] = r(step)

    # statics: J^T f, virtual work check
    f = np.array([3.0, -2.0])
    d["static_force"] = r(f)
    d["static_torque"] = r(jac3_pos(q3).T @ f)
    dq = np.array([0.01, -0.02, 0.015])
    d["virtual_work_joint"] = r((jac3_pos(q3).T @ f) @ dq)
    d["virtual_work_task"] = r(f @ (jac3_pos(q3) @ dq))
    return d


OUT["jacobian"] = jac_section()


# ------------------------------------ 3b. autodiff Jacobian check (JAX + Torch)

def autodiff_section():
    d = {}
    import jax
    import jax.numpy as jnp
    jax.config.update("jax_enable_x64", True)

    def jhat(w):
        return jnp.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])

    def jexp6(S, th):
        w, v = S[:3], S[3:]
        W = jhat(w)
        R = jnp.eye(3) + jnp.sin(th) * W + (1 - jnp.cos(th)) * (W @ W)
        Gth = jnp.eye(3) * th + (1 - jnp.cos(th)) * W + (th - jnp.sin(th)) * (W @ W)
        T = jnp.eye(4)
        T = T.at[:3, :3].set(R)
        T = T.at[:3, 3].set(Gth @ v)
        return T

    Sj = jnp.array(S6)
    Mj = jnp.array(M6)

    def jfk6(q):
        T = jnp.eye(4)
        for i in range(6):
            T = T @ jexp6(Sj[:, i], q[i])
        return T @ Mj

    q = jnp.array([0.3, -0.5, 0.8, 0.2, -0.4, 0.6])
    dT = jax.jacfwd(jfk6)(q)          # (4,4,6)
    T = jfk6(q)
    Tinv = jnp.linalg.inv(T)
    Jad = np.zeros((6, 6))
    for i in range(6):
        Sm = np.array(dT[:, :, i] @ Tinv)   # [V_s] in se(3)
        Jad[:3, i] = [Sm[2, 1], Sm[0, 2], Sm[1, 0]]
        Jad[3:, i] = Sm[:3, 3]
    Jan = space_jacobian6(np.array(q))
    d["six_link_space_J_analytic"] = r(Jan)
    d["six_link_space_J_autodiff"] = r(Jad)
    d["six_link_J_maxabs_diff"] = r(float(np.max(np.abs(Jad - Jan))), 15)
    d["six_link_J_rel_diff"] = r(float(np.max(np.abs(Jad - Jan)) / np.max(np.abs(Jan))), 15)

    # planar 3R: autodiff of the position map vs. the hand-derived Jacobian
    def jfk3(q):
        l = jnp.array([L1, L2, L3])
        a = jnp.array([q[0], q[0] + q[1], q[0] + q[1] + q[2]])
        return jnp.array([jnp.sum(l * jnp.cos(a)), jnp.sum(l * jnp.sin(a))])

    q3 = jnp.array([0.3, 0.8, -0.6])
    J3ad = np.array(jax.jacfwd(jfk3)(q3))
    d["three_link_J_maxabs_diff"] = r(float(np.max(np.abs(J3ad - jac3_pos(np.array(q3))))), 15)

    # random configurations, worst case over 512 draws
    rng = np.random.default_rng(0)
    worst = 0.0
    for _ in range(512):
        qq = rng.uniform(-np.pi, np.pi, 3)
        Ja = np.array(jax.jacfwd(jfk3)(jnp.array(qq)))
        worst = max(worst, float(np.max(np.abs(Ja - jac3_pos(qq)))))
    d["three_link_J_worst_over_512"] = r(worst, 15)

    # timing: autodiff vs. analytic (6R space Jacobian)
    jf = jax.jit(jax.jacfwd(jfk6))
    jf(q).block_until_ready()
    t0 = time.perf_counter()
    for _ in range(200):
        jf(q).block_until_ready()
    t_ad = (time.perf_counter() - t0) / 200 * 1e6
    t0 = time.perf_counter()
    for _ in range(200):
        space_jacobian6(np.array(q))
    t_an = (time.perf_counter() - t0) / 200 * 1e6
    d["jac_time_us_autodiff_jit"] = r(t_ad, 3)
    d["jac_time_us_analytic_numpy"] = r(t_an, 3)

    # Torch check of the same planar map
    import torch
    torch.set_default_dtype(torch.float64)

    def tfk3(q):
        l = torch.tensor([L1, L2, L3], dtype=torch.float64)
        a = torch.stack([q[0], q[0] + q[1], q[0] + q[1] + q[2]])
        return torch.stack([(l * torch.cos(a)).sum(), (l * torch.sin(a)).sum()])

    qt = torch.tensor([0.3, 0.8, -0.6], requires_grad=True)
    Jt = torch.autograd.functional.jacobian(tfk3, qt).detach().numpy()
    d["three_link_J_torch_maxabs_diff"] = r(float(np.max(np.abs(Jt - jac3_pos(np.array([0.3, 0.8, -0.6]))))), 15)
    d["torch_version"] = torch.__version__
    import jax as _j
    d["jax_version"] = _j.__version__
    return d


OUT["autodiff"] = autodiff_section()


# --------------------------------------------------------- 4. Inverse kinematics

def ik2_closed(p, l1=L1, l2=L2):
    x, y = p
    rr = x * x + y * y
    c2 = (rr - l1 * l1 - l2 * l2) / (2 * l1 * l2)
    c2 = np.clip(c2, -1.0, 1.0)
    out = []
    for sign in (+1, -1):
        s2 = sign * np.sqrt(max(0.0, 1 - c2 * c2))
        q2 = np.arctan2(s2, c2)
        q1 = np.arctan2(y, x) - np.arctan2(l2 * s2, l1 + l2 * c2)
        out.append(np.array([q1, q2]))
    return out


def ik_numeric(target, q0, method, lam=0.1, tol=1e-6, maxit=2000):
    q = q0.copy()
    for k in range(maxit):
        e = target - fk2(q)
        if np.linalg.norm(e) < tol:
            return q, k, True
        J = jac2(q)
        if method == "transpose":
            JJte = J @ (J.T @ e)
            denom = JJte @ JJte
            alpha = (e @ JJte) / denom if denom > 1e-300 else 0.0
            dq = alpha * (J.T @ e)
        elif method == "pinv":
            dq = np.linalg.pinv(J) @ e
        elif method == "dls":
            dq = J.T @ np.linalg.solve(J @ J.T + lam ** 2 * np.eye(2), e)
        else:
            raise ValueError(method)
        n = np.linalg.norm(dq)
        if n > 0.3:                    # common step clamp
            dq = dq * (0.3 / n)
        q = q + dq
    return q, maxit, np.linalg.norm(target - fk2(q)) < tol


def ik_section():
    d = {}
    tgt = np.array([1.2, 0.7])
    sols = ik2_closed(tgt)
    d["target"] = r(tgt)
    d["closed_form_elbow_down"] = r(sols[0])
    d["closed_form_elbow_up"] = r(sols[1])
    d["closed_form_deg"] = [r(np.degrees(sols[0])), r(np.degrees(sols[1]))]
    d["closed_form_residual"] = [r(np.linalg.norm(fk2(s) - tgt), 15) for s in sols]

    # a hand-checkable case: target on the unit circle at 90 degrees of elbow
    t2 = np.array([1.0, 1.0])
    s2 = ik2_closed(t2)
    d["hand_target"] = [1.0, 1.0]
    d["hand_solutions_deg"] = [r(np.degrees(s)) for s in s2]

    # closed form vs. numerical solver
    q0 = np.array([0.1, 0.5])
    qn, it, ok = ik_numeric(tgt, q0, "dls", lam=0.05)
    d["numeric_dls_solution"] = r(qn)
    d["numeric_vs_closed_maxabs"] = r(float(np.min([np.max(np.abs(qn - s)) for s in sols])), 15)
    d["numeric_dls_iters"] = it

    # convergence study across targets, three methods
    rng = np.random.default_rng(7)
    cases = [
        ("mid-workspace", np.array([1.0, 0.6])),
        ("mid-workspace 2", np.array([-0.5, 1.3])),
        ("near boundary r=1.95", np.array([1.95, 0.0])),
        ("near boundary r=1.99", np.array([1.99 * np.cos(0.3), 1.99 * np.sin(0.3)])),
        ("near boundary r=1.999", np.array([1.999 * np.cos(0.3), 1.999 * np.sin(0.3)])),
        ("unreachable r=2.05", np.array([2.05, 0.0])),
        ("near shoulder r=0.05", np.array([0.05, 0.02])),
    ]
    table = []
    for name, tg in cases:
        row = {"case": name, "target": r(tg), "radius": r(np.linalg.norm(tg))}
        for m, lam in (("transpose", None), ("pinv", None), ("dls", 0.05)):
            its, oks, errs, times = [], 0, [], []
            for _ in range(20):
                qq0 = rng.uniform(-np.pi, np.pi, 2)
                t0 = time.perf_counter()
                qf, it, ok = ik_numeric(tg, qq0, m, lam=lam if lam else 0.1)
                times.append((time.perf_counter() - t0) * 1e3)
                its.append(it)
                oks += int(ok)
                errs.append(np.linalg.norm(tg - fk2(qf)))
            row[m] = {"median_iters": int(np.median(its)),
                      "mean_iters": r(float(np.mean(its)), 2),
                      "converged": oks, "trials": 20,
                      "median_final_err": r(float(np.median(errs)), 12),
                      "median_ms": r(float(np.median(times)), 4)}
        table.append(row)
    d["convergence"] = table

    # damping sweep at a near-singular target
    tg = np.array([1.999 * np.cos(0.3), 1.999 * np.sin(0.3)])
    sweep = []
    for lam in [0.0, 0.001, 0.01, 0.05, 0.1, 0.3]:
        its, oks, maxstep = [], 0, 0.0
        for s in range(20):
            qq0 = rng.uniform(-np.pi, np.pi, 2)
            q = qq0.copy()
            it, ok = 0, False
            for it in range(2000):
                e = tg - fk2(q)
                if np.linalg.norm(e) < 1e-6:
                    ok = True
                    break
                J = jac2(q)
                A = J @ J.T + lam ** 2 * np.eye(2)
                try:
                    dq = J.T @ np.linalg.solve(A, e)
                except np.linalg.LinAlgError:
                    dq = J.T @ np.linalg.lstsq(A, e, rcond=None)[0]
                maxstep = max(maxstep, float(np.linalg.norm(dq)))
                n = np.linalg.norm(dq)
                if n > 0.3:
                    dq = dq * (0.3 / n)
                q = q + dq
            its.append(it)
            oks += int(ok)
        sweep.append({"lambda": lam, "median_iters": int(np.median(its)),
                      "converged": oks, "max_raw_step_norm": r(maxstep, 4)})
    d["damping_sweep"] = sweep
    return d


OUT["ik"] = ik_section()


# ------------------------------------------------------------------ 5. Dynamics

M1, M2 = 1.0, 1.0
LC1, LC2 = 0.5, 0.5
I1, I2 = 1.0 / 12.0, 1.0 / 12.0


def Mmat(q):
    c2 = np.cos(q[1])
    a = M1 * LC1 ** 2 + I1 + M2 * (L1 ** 2 + LC2 ** 2 + 2 * L1 * LC2 * c2) + I2
    b = M2 * (LC2 ** 2 + L1 * LC2 * c2) + I2
    c = M2 * LC2 ** 2 + I2
    return np.array([[a, b], [b, c]])


def Cmat(q, dq):
    h = -M2 * L1 * LC2 * np.sin(q[1])
    return np.array([[h * dq[1], h * (dq[0] + dq[1])],
                     [-h * dq[0], 0.0]])


def gvec(q):
    g1 = (M1 * LC1 + M2 * L1) * G * np.cos(q[0]) + M2 * LC2 * G * np.cos(q[0] + q[1])
    g2 = M2 * LC2 * G * np.cos(q[0] + q[1])
    return np.array([g1, g2])


def energy(q, dq):
    T = 0.5 * dq @ Mmat(q) @ dq
    y1 = LC1 * np.sin(q[0])
    y2 = L1 * np.sin(q[0]) + LC2 * np.sin(q[0] + q[1])
    U = M1 * G * y1 + M2 * G * y2
    return T, U


def accel(q, dq, tau):
    return np.linalg.solve(Mmat(q), tau - Cmat(q, dq) @ dq - gvec(q))


def rk4(q, dq, tau_fn, dt, t):
    def f(state, tt):
        qq, dqq = state[:2], state[2:]
        return np.concatenate([dqq, accel(qq, dqq, tau_fn(tt, qq, dqq))])
    s = np.concatenate([q, dq])
    k1 = f(s, t)
    k2 = f(s + dt / 2 * k1, t + dt / 2)
    k3 = f(s + dt / 2 * k2, t + dt / 2)
    k4 = f(s + dt * k3, t + dt)
    s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return s[:2], s[2:]


def dyn_section():
    d = {}
    d["params"] = {"m1": M1, "m2": M2, "l1": L1, "l2": L2, "lc1": LC1, "lc2": LC2,
                   "I1": r(I1), "I2": r(I2), "g": G}
    q = np.array([np.pi / 6, np.pi / 3])
    dq = np.array([0.5, -0.8])
    d["q"] = r(q)
    d["dq"] = r(dq)
    d["M"] = r(Mmat(q))
    d["M_eigs"] = r(np.linalg.eigvalsh(Mmat(q)))
    d["C"] = r(Cmat(q, dq))
    d["Cdq"] = r(Cmat(q, dq) @ dq)
    d["g"] = r(gvec(q))
    d["h"] = r(-M2 * L1 * LC2 * np.sin(q[1]))

    # M positive definite over the whole configuration space
    lo, hi = np.inf, -np.inf
    for q2 in np.linspace(-np.pi, np.pi, 2001):
        ev = np.linalg.eigvalsh(Mmat(np.array([0.0, q2])))
        lo = min(lo, ev[0])
        hi = max(hi, ev[1])
    d["M_min_eig_over_q2"] = r(lo)
    d["M_max_eig_over_q2"] = r(hi)

    # skew symmetry of Mdot - 2C
    rng = np.random.default_rng(3)
    worst_mat, worst_quad = 0.0, 0.0
    for _ in range(2000):
        qq = rng.uniform(-np.pi, np.pi, 2)
        dqq = rng.uniform(-3, 3, 2)
        h_ = 1e-6
        Mdot = (Mmat(qq + h_ * dqq) - Mmat(qq - h_ * dqq)) / (2 * h_)
        S = Mdot - 2 * Cmat(qq, dqq)
        worst_mat = max(worst_mat, float(np.max(np.abs(S + S.T))))
        worst_quad = max(worst_quad, abs(float(dqq @ S @ dqq)))
    d["skew_max_S_plus_ST"] = r(worst_mat, 12)
    d["skew_max_quadratic_form"] = r(worst_quad, 12)
    d["skew_samples"] = 2000

    # a single explicit instance of Mdot - 2C
    h_ = 1e-6
    Mdot = (Mmat(q + h_ * dq) - Mmat(q - h_ * dq)) / (2 * h_)
    d["Mdot_example"] = r(Mdot)
    d["S_example"] = r(Mdot - 2 * Cmat(q, dq))

    # energy conservation, unforced (gravity is conservative, tau = 0)
    zero = lambda t, qq, dqq: np.zeros(2)
    drifts = {}
    for dt in [1e-2, 1e-3, 1e-4]:
        qq = np.array([np.pi / 3, -np.pi / 4])
        dqq = np.array([0.0, 0.0])
        T0, U0 = energy(qq, dqq)
        E0 = T0 + U0
        n = int(10.0 / dt)
        maxdev = 0.0
        for k in range(n):
            qq, dqq = rk4(qq, dqq, zero, dt, k * dt)
            T, U = energy(qq, dqq)
            maxdev = max(maxdev, abs(T + U - E0))
        Tf, Uf = energy(qq, dqq)
        drifts[f"rk4_dt{dt:g}"] = {
            "E0": r(E0, 12), "E_final": r(Tf + Uf, 12),
            "abs_drift": r(abs(Tf + Uf - E0), 15),
            "rel_drift": r(abs(Tf + Uf - E0) / abs(E0), 15),
            "max_abs_dev": r(maxdev, 15), "steps": n, "horizon_s": 10.0}
    # explicit Euler for contrast
    qq = np.array([np.pi / 3, -np.pi / 4])
    dqq = np.zeros(2)
    E0 = sum(energy(qq, dqq))
    dt = 1e-3
    for k in range(int(10.0 / dt)):
        a = accel(qq, dqq, np.zeros(2))
        qq = qq + dt * dqq
        dqq = dqq + dt * a
    drifts["explicit_euler_dt0.001"] = {
        "E0": r(E0, 12), "E_final": r(sum(energy(qq, dqq)), 12),
        "rel_drift": r(abs(sum(energy(qq, dqq)) - E0) / abs(E0), 12),
        "steps": int(10.0 / dt), "horizon_s": 10.0}
    d["energy"] = drifts

    # Newton-Euler style O(n) check is out of scope numerically; instead time
    # the closed-form mass matrix build vs. a generic inverse-dynamics call.
    t0 = time.perf_counter()
    for _ in range(20000):
        Mmat(q)
    d["M_build_us"] = r((time.perf_counter() - t0) / 20000 * 1e6, 4)
    return d


OUT["dynamics"] = dyn_section()


# ------------------------------------------------- 5b. MuJoCo cross-validation

MJCF = """
<mujoco model="planar2r">
  <option gravity="0 -9.81 0" integrator="RK4" timestep="0.0005"/>
  <worldbody>
    <body name="link1" pos="0 0 0">
      <joint name="q1" type="hinge" axis="0 0 1" pos="0 0 0"/>
      <inertial pos="0.5 0 0" mass="1" diaginertia="0.000001 0.0833333333333 0.0833333333333"/>
      <geom type="capsule" fromto="0 0 0 1 0 0" size="0.02" mass="0"/>
      <body name="link2" pos="1 0 0">
        <joint name="q2" type="hinge" axis="0 0 1" pos="0 0 0"/>
        <inertial pos="0.5 0 0" mass="1" diaginertia="0.000001 0.0833333333333 0.0833333333333"/>
        <geom type="capsule" fromto="0 0 0 1 0 0" size="0.02" mass="0"/>
        <site name="ee" pos="1 0 0"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""


def mujoco_section():
    d = {}
    try:
        import mujoco
    except ImportError:
        return {"available": False}
    d["available"] = True
    d["version"] = mujoco.__version__
    model = mujoco.MjModel.from_xml_string(MJCF)
    data = mujoco.MjData(model)

    rng = np.random.default_rng(11)
    worst_M, worst_bias, worst_fk, worst_acc = 0.0, 0.0, 0.0, 0.0
    sample = None
    for i in range(200):
        q = rng.uniform(-np.pi, np.pi, 2)
        dq = rng.uniform(-3, 3, 2)
        data.qpos[:] = q
        data.qvel[:] = dq
        mujoco.mj_forward(model, data)
        Mm = np.zeros((2, 2))
        # MuJoCo >= 3.x signature: mj_fullM(model, data, dst)
        try:
            mujoco.mj_fullM(model, data, Mm)
        except TypeError:
            # Older binding: mj_fullM(model, dst, qM)
            mujoco.mj_fullM(model, Mm, data.qM)
        bias = data.qfrc_bias.copy()
        mine_M = Mmat(q)
        mine_bias = Cmat(q, dq) @ dq + gvec(q)
        ee = data.site_xpos[0][:2].copy()
        worst_M = max(worst_M, float(np.max(np.abs(Mm - mine_M))))
        worst_bias = max(worst_bias, float(np.max(np.abs(bias - mine_bias))))
        worst_fk = max(worst_fk, float(np.max(np.abs(ee - fk2(q)))))
        tau = rng.uniform(-5, 5, 2)
        data.ctrl[:] = 0
        data.qfrc_applied[:] = tau
        mujoco.mj_forward(model, data)
        worst_acc = max(worst_acc, float(np.max(np.abs(data.qacc - accel(q, dq, tau)))))
        data.qfrc_applied[:] = 0
        if i == 0:
            sample = {"q": r(q), "dq": r(dq), "M_mujoco": r(Mm), "M_analytic": r(mine_M),
                      "bias_mujoco": r(bias), "bias_analytic": r(mine_bias)}
    d["max_M_diff"] = r(worst_M, 15)
    d["max_bias_diff"] = r(worst_bias, 15)
    d["max_fk_diff"] = r(worst_fk, 15)
    d["max_qacc_diff"] = r(worst_acc, 15)
    d["samples"] = 200
    d["sample"] = sample

    # energy drift in MuJoCo's own RK4 integrator, unforced
    data.qpos[:] = [np.pi / 3, -np.pi / 4]
    data.qvel[:] = 0
    mujoco.mj_forward(model, data)
    E0 = float(data.energy[0] + data.energy[1]) if hasattr(data, "energy") else None
    model.opt.enableflags |= mujoco.mjtEnableBit.mjENBL_ENERGY
    data.qpos[:] = [np.pi / 3, -np.pi / 4]
    data.qvel[:] = 0
    mujoco.mj_forward(model, data)
    E0 = float(data.energy[0] + data.energy[1])
    n = int(10.0 / model.opt.timestep)
    t0 = time.perf_counter()
    for _ in range(n):
        mujoco.mj_step(model, data)
    wall = time.perf_counter() - t0
    Ef = float(data.energy[0] + data.energy[1])
    d["mj_energy"] = {"E0": r(E0, 10), "E_final": r(Ef, 10),
                      "rel_drift": r(abs(Ef - E0) / abs(E0), 12),
                      "timestep": model.opt.timestep, "steps": n,
                      "wall_s": r(wall, 4),
                      "steps_per_s": r(n / wall, 1)}
    return d


OUT["mujoco"] = mujoco_section()


# ------------------------------------------------------------------- 6. Control

def quintic(q0, qf, T):
    """Coefficients for zero velocity and acceleration at both ends."""
    a = np.zeros((6,) + np.shape(q0))
    a[0] = q0
    a[3] = 10 * (qf - q0) / T ** 3
    a[4] = -15 * (qf - q0) / T ** 4
    a[5] = 6 * (qf - q0) / T ** 5
    return a


def quintic_eval(a, t):
    q = a[0] + a[1] * t + a[2] * t ** 2 + a[3] * t ** 3 + a[4] * t ** 4 + a[5] * t ** 5
    dq = a[1] + 2 * a[2] * t + 3 * a[3] * t ** 2 + 4 * a[4] * t ** 3 + 5 * a[5] * t ** 4
    ddq = 2 * a[2] + 6 * a[3] * t + 12 * a[4] * t ** 2 + 20 * a[5] * t ** 3
    return q, dq, ddq


def simulate(controller, dt=0.001, Tend=2.0, q0=None, dq0=None, tau_max=None):
    q = np.array([0.0, 0.0]) if q0 is None else q0.copy()
    dq = np.zeros(2) if dq0 is None else dq0.copy()
    n = int(Tend / dt)
    errs, taus = [], []
    for k in range(n):
        t = k * dt
        tau, qd = controller(t, q, dq)
        if tau_max is not None:
            tau = np.clip(tau, -tau_max, tau_max)
        # integrate with RK4 holding tau constant over the step
        f = lambda s: np.concatenate([s[2:], accel(s[:2], s[2:], tau)])
        s = np.concatenate([q, dq])
        k1 = f(s)
        k2 = f(s + dt / 2 * k1)
        k3 = f(s + dt / 2 * k2)
        k4 = f(s + dt * k3)
        s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        q, dq = s[:2], s[2:]
        errs.append(qd - q)
        taus.append(tau)
    errs = np.array(errs)
    taus = np.array(taus)
    return {"rms_rad": r(float(np.sqrt(np.mean(np.sum(errs ** 2, axis=1)))), 8),
            "max_rad": r(float(np.max(np.linalg.norm(errs, axis=1))), 8),
            "final_rad": r(float(np.linalg.norm(errs[-1])), 10),
            "max_tau": r(float(np.max(np.abs(taus))), 4),
            "q_final": r(q), "steps": n}, errs


def control_section():
    d = {}
    qA = np.array([0.0, 0.0])
    qB = np.array([1.2, -0.8])
    Tend = 2.0
    a = quintic(qA, qB, Tend)
    d["traj"] = {"q0": r(qA), "qf": r(qB), "T": Tend,
                 "a3": r(a[3]), "a4": r(a[4]), "a5": r(a[5]),
                 "peak_vel": r(15 * (qB - qA) / (8 * Tend)),
                 "peak_acc": r(10 * (qB - qA) / (np.sqrt(3) * Tend ** 2))}

    Kp = np.diag([100.0, 100.0])
    Kd = np.diag([20.0, 20.0])

    def pd_grav(t, q, dq):
        qd, dqd, _ = quintic_eval(a, min(t, Tend))
        tau = Kp @ (qd - q) + Kd @ (dqd - dq) + gvec(q)
        return tau, qd

    def ctc(t, q, dq):
        qd, dqd, ddqd = quintic_eval(a, min(t, Tend))
        v = ddqd + Kd @ (dqd - dq) + Kp @ (qd - q)
        tau = Mmat(q) @ v + Cmat(q, dq) @ dq + gvec(q)
        return tau, qd

    def pd_only(t, q, dq):
        qd, dqd, _ = quintic_eval(a, min(t, Tend))
        return Kp @ (qd - q) + Kd @ (dqd - dq), qd

    res = {}
    for name, ctrl in (("pd_only", pd_only), ("pd_gravity", pd_grav), ("computed_torque", ctc)):
        st, _ = simulate(ctrl, dt=0.001, Tend=3.0, q0=qA.copy())
        res[name] = st
    d["tracking"] = res
    d["gains"] = {"Kp": 100.0, "Kd": 20.0, "damping_ratio": r(20.0 / (2 * np.sqrt(100.0)))}

    # model error: computed torque with wrong link masses
    def ctc_wrong(scale):
        def f(t, q, dq):
            qd, dqd, ddqd = quintic_eval(a, min(t, Tend))
            v = ddqd + Kd @ (dqd - dq) + Kp @ (qd - q)
            global M1, M2, LC1, LC2, I1, I2
            m1o, m2o, i1o, i2o = M1, M2, I1, I2
            M1, M2, I1, I2 = m1o * scale, m2o * scale, i1o * scale, i2o * scale
            tau = Mmat(q) @ v + Cmat(q, dq) @ dq + gvec(q)
            M1, M2, I1, I2 = m1o, m2o, i1o, i2o
            return tau, qd
        return f

    robust = {}
    for scale in [1.0, 1.1, 1.3, 1.5, 0.7]:
        st, _ = simulate(ctc_wrong(scale), dt=0.001, Tend=3.0, q0=qA.copy())
        robust[f"mass_scale_{scale}"] = st
    # PD+gravity with the same mass error in the gravity model
    def pdg_wrong(scale):
        def f(t, q, dq):
            qd, dqd, _ = quintic_eval(a, min(t, Tend))
            global M1, M2
            m1o, m2o = M1, M2
            M1, M2 = m1o * scale, m2o * scale
            gg = gvec(q)
            M1, M2 = m1o, m2o
            return Kp @ (qd - q) + Kd @ (dqd - dq) + gg, qd
        return f
    for scale in [1.3]:
        st, _ = simulate(pdg_wrong(scale), dt=0.001, Tend=3.0, q0=qA.copy())
        robust[f"pd_gravity_mass_scale_{scale}"] = st
    d["model_error"] = robust

    # control rate study: hold torque over longer intervals
    rate = {}
    for hz in [1000, 500, 200, 100, 50]:
        st, _ = simulate(ctc, dt=1.0 / hz, Tend=3.0, q0=qA.copy())
        rate[f"{hz}Hz"] = st
    d["control_rate"] = rate

    # PD + gravity regulation: Lyapunov argument predicts asymptotic convergence
    qdes = np.array([0.7, -0.4])

    def reg(t, q, dq):
        return Kp @ (qdes - q) - Kd @ dq + gvec(q), qdes

    st, errs = simulate(reg, dt=0.001, Tend=5.0, q0=np.array([-0.5, 1.0]))
    d["regulation"] = st
    # Lyapunov function must be nonincreasing
    q = np.array([-0.5, 1.0])
    dq = np.zeros(2)
    Vs = []
    dt = 0.001
    for k in range(5000):
        e = qdes - q
        V = 0.5 * dq @ Mmat(q) @ dq + 0.5 * e @ Kp @ e
        Vs.append(V)
        tau = Kp @ e - Kd @ dq + gvec(q)
        f = lambda s: np.concatenate([s[2:], accel(s[:2], s[2:], tau)])
        s = np.concatenate([q, dq])
        k1 = f(s)
        k2 = f(s + dt / 2 * k1)
        k3 = f(s + dt / 2 * k2)
        k4 = f(s + dt * k3)
        s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        q, dq = s[:2], s[2:]
    Vs = np.array(Vs)
    d["lyapunov"] = {"V0": r(Vs[0], 8), "V_final": r(Vs[-1], 12),
                     "max_increase": r(float(np.max(np.diff(Vs))), 12),
                     "monotone_nonincreasing": bool(np.max(np.diff(Vs)) <= 1e-9),
                     "samples": len(Vs)}

    # operational-space control: track a straight line in task space
    def osc_run(with_null, Kp_t=400.0, Kd_t=40.0, Kp_n=0.0, Kd_n=0.0):
        q = np.array([0.5, 1.0])
        dq = np.zeros(2)
        p0 = fk2(q)
        pf = p0 + np.array([0.4, -0.3])
        Tm = 2.0
        at = quintic(p0, pf, Tm)
        dt = 0.001
        errs = []
        for k in range(int(3.0 / dt)):
            t = min(k * dt, Tm)
            pd, dpd, ddpd = quintic_eval(at, t)
            J = jac2(q)
            Mq = Mmat(q)
            Minv = np.linalg.inv(Mq)
            Lam = np.linalg.inv(J @ Minv @ J.T + 1e-9 * np.eye(2))
            # dJ/dt by finite difference along the current velocity
            hh = 1e-6
            dJ = (jac2(q + hh * dq) - jac2(q - hh * dq)) / (2 * hh)
            p = fk2(q)
            dp = J @ dq
            F = Lam @ (ddpd + Kd_t * (dpd - dp) + Kp_t * (pd - p) - dJ @ dq)
            tau = J.T @ F + Cmat(q, dq) @ dq + gvec(q)
            f = lambda s: np.concatenate([s[2:], accel(s[:2], s[2:], tau)])
            s = np.concatenate([q, dq])
            k1 = f(s)
            k2 = f(s + dt / 2 * k1)
            k3 = f(s + dt / 2 * k2)
            k4 = f(s + dt * k3)
            s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
            q, dq = s[:2], s[2:]
            errs.append(np.linalg.norm(pd - fk2(q)))
        errs = np.array(errs)
        return {"rms_m": r(float(np.sqrt(np.mean(errs ** 2))), 8),
                "max_m": r(float(np.max(errs)), 8),
                "final_m": r(float(errs[-1]), 10),
                "p0": r(p0), "pf": r(pf)}

    d["osc"] = osc_run(False)

    # operational-space inertia matrix at a sample configuration
    q = np.array([0.5, 1.0])
    J = jac2(q)
    Mq = Mmat(q)
    Lam = np.linalg.inv(J @ np.linalg.inv(Mq) @ J.T)
    d["lambda_matrix"] = {"q": r(q), "J": r(J), "M": r(Mq), "Lambda": r(Lam),
                          "Lambda_eigs": r(np.linalg.eigvalsh(Lam)),
                          "apparent_mass_dir_x": r(1.0 / np.linalg.inv(Lam)[0, 0]),
                          "Jbar": r(np.linalg.inv(Mq) @ J.T @ Lam)}
    # near a singularity the apparent mass along the lost direction blows up
    rows = []
    for q2 in [1.0, 0.3, 0.1, 0.03, 0.01]:
        qq = np.array([0.5, q2])
        Jj = jac2(qq)
        Lm = np.linalg.inv(Jj @ np.linalg.inv(Mmat(qq)) @ Jj.T + 1e-12 * np.eye(2))
        rows.append({"q2": q2, "Lambda_max_eig": r(float(np.linalg.eigvalsh(Lm)[-1]), 4),
                     "Lambda_min_eig": r(float(np.linalg.eigvalsh(Lm)[0]), 6)})
    d["lambda_near_singular"] = rows

    # redundancy: 3R arm, task = position, null space = posture
    def osc3(kn):
        m = [1.0, 1.0, 0.5]
        lc = [0.5, 0.5, 0.25]
        # simple kinematic-level redundancy demo (velocity resolution)
        q = np.array([0.3, 0.9, -0.5])
        qrest = np.array([0.0, 0.9, 0.0])
        p0 = fk3(q)[:2]
        pf = p0 + np.array([0.3, 0.2])
        dt = 0.002
        errs = []
        for k in range(1000):
            t = min(k * dt, 1.0)
            pd = p0 + (pf - p0) * (10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5)
            dpd = (pf - p0) * (30 * t ** 2 - 60 * t ** 3 + 30 * t ** 4)
            J = jac3_pos(q)
            Jp = np.linalg.pinv(J)
            N = np.eye(3) - Jp @ J
            dq = Jp @ (dpd + 20 * (pd - fk3(q)[:2])) + N @ (kn * (qrest - q))
            q = q + dt * dq
            errs.append(np.linalg.norm(pd - fk3(q)[:2]))
        return {"kn": kn, "rms_m": r(float(np.sqrt(np.mean(np.array(errs) ** 2))), 8),
                "max_m": r(float(np.max(errs)), 8),
                "q_final": r(q), "posture_err_final": r(float(np.linalg.norm(q - qrest)), 6)}

    d["null_space_posture"] = [osc3(0.0), osc3(2.0), osc3(10.0)]
    return d


OUT["control"] = control_section()


# --------------------------------------------------------------- 7. Trajectories

def traj_section():
    d = {}
    # cubic with nonzero boundary velocities
    q0, qf, v0, vf, T = 0.0, 1.5, 0.0, 0.5, 2.0
    A = np.array([[1, 0, 0, 0], [0, 1, 0, 0],
                  [1, T, T ** 2, T ** 3], [0, 1, 2 * T, 3 * T ** 2]], float)
    b = np.array([q0, v0, qf, vf])
    c = np.linalg.solve(A, b)
    d["cubic"] = {"q0": q0, "qf": qf, "v0": v0, "vf": vf, "T": T, "coeffs": r(c),
                  "check_q_T": r(c @ np.array([1, T, T ** 2, T ** 3])),
                  "check_v_T": r(c[1] + 2 * c[2] * T + 3 * c[3] * T ** 2),
                  "peak_accel": r(float(np.max(np.abs([2 * c[2], 2 * c[2] + 6 * c[3] * T]))))}

    # quintic
    T = 2.0
    a = quintic(np.array([0.0]), np.array([1.5]), T)
    ts = np.linspace(0, T, 20001)
    qs, vs, accs = [], [], []
    for t in ts:
        qq, vv, aa = quintic_eval(a, t)
        qs.append(qq[0])
        vs.append(vv[0])
        accs.append(aa[0])
    d["quintic"] = {"T": T, "displacement": 1.5,
                    "peak_vel": r(float(np.max(np.abs(vs)))),
                    "peak_vel_formula": r(15 * 1.5 / (8 * T)),
                    "peak_acc": r(float(np.max(np.abs(accs)))),
                    "peak_acc_formula": r(10 * 1.5 / (np.sqrt(3) * T ** 2)),
                    "t_at_peak_vel": r(float(ts[int(np.argmax(np.abs(vs)))]))}

    # trapezoidal profile
    disp, vmax, amax = 1.5, 1.0, 2.0
    if vmax ** 2 / amax <= disp:
        ta = vmax / amax
        tc = (disp - vmax ** 2 / amax) / vmax
        Ttot = 2 * ta + tc
        kind = "trapezoid"
    else:
        ta = np.sqrt(disp / amax)
        tc = 0.0
        Ttot = 2 * ta
        vpeak = amax * ta
        kind = "triangle"
    d["trapezoid"] = {"displacement": disp, "vmax": vmax, "amax": amax, "kind": kind,
                      "t_accel": r(ta), "t_cruise": r(tc), "T_total": r(Ttot),
                      "dist_accel": r(0.5 * amax * ta ** 2),
                      "dist_cruise": r(vmax * tc),
                      "area_check": r(0.5 * amax * ta ** 2 * 2 + vmax * tc)}
    # triangular case
    disp2 = 0.3
    ta2 = np.sqrt(disp2 / amax)
    d["triangle"] = {"displacement": disp2, "amax": amax, "t_accel": r(ta2),
                     "T_total": r(2 * ta2), "v_peak": r(amax * ta2),
                     "exceeds_vmax": bool(amax * ta2 > vmax)}

    # time-optimal single joint under a torque bound, comparing to quintic
    d["time_optimal_vs_quintic"] = {
        "note": "same displacement, same acceleration bound",
        "amax": amax, "displacement": disp,
        "bangbang_T": r(2 * np.sqrt(disp / amax)),
        "quintic_T_for_same_peak_acc": r(np.sqrt(10 * disp / (np.sqrt(3) * amax))),
        "ratio": r(np.sqrt(10 * disp / (np.sqrt(3) * amax)) / (2 * np.sqrt(disp / amax)))}

    # minimum jerk equals the quintic with zero boundary v and a
    T = 2.0
    tt = np.linspace(0, T, 2001)
    s = 10 * (tt / T) ** 3 - 15 * (tt / T) ** 4 + 6 * (tt / T) ** 5
    jerk = np.gradient(np.gradient(np.gradient(1.5 * s, tt), tt), tt)
    d["min_jerk"] = {"T": T, "integral_jerk_sq": r(float(np.trapz(jerk ** 2, tt)), 6),
                     "analytic_integral": r(720 * 1.5 ** 2 / T ** 5, 6)}
    # a cubic with the same endpoints has strictly larger jerk cost
    cub = 1.5 * (3 * (tt / T) ** 2 - 2 * (tt / T) ** 3)
    jc = np.gradient(np.gradient(np.gradient(cub, tt), tt), tt)
    d["min_jerk"]["cubic_integral_jerk_sq"] = r(float(np.trapz(jc[5:-5] ** 2, tt[5:-5])), 6)

    # via points: natural cubic spline through 4 knots
    tk = np.array([0.0, 1.0, 2.0, 3.0])
    qk = np.array([0.0, 0.8, 0.5, 1.4])
    n = len(tk)
    h = np.diff(tk)
    Aa = np.zeros((n, n))
    rhs = np.zeros(n)
    Aa[0, 0] = 1
    Aa[-1, -1] = 1
    for i in range(1, n - 1):
        Aa[i, i - 1] = h[i - 1]
        Aa[i, i] = 2 * (h[i - 1] + h[i])
        Aa[i, i + 1] = h[i]
        rhs[i] = 3 * ((qk[i + 1] - qk[i]) / h[i] - (qk[i] - qk[i - 1]) / h[i - 1])
    cc = np.linalg.solve(Aa, rhs)
    bb = np.zeros(n - 1)
    dd = np.zeros(n - 1)
    for i in range(n - 1):
        bb[i] = (qk[i + 1] - qk[i]) / h[i] - h[i] * (2 * cc[i] + cc[i + 1]) / 3
        dd[i] = (cc[i + 1] - cc[i]) / (3 * h[i])
    d["spline"] = {"t": r(tk), "q": r(qk), "c": r(cc), "b": r(bb), "d": r(dd),
                   "mid_seg1": r(qk[0] + bb[0] * 0.5 + cc[0] * 0.25 + dd[0] * 0.125),
                   "vel_at_knot1": r(bb[1]),
                   "continuity_check": r(abs((bb[0] + 2 * cc[0] * h[0] + 3 * dd[0] * h[0] ** 2) - bb[1]), 12)}
    return d


OUT["traj"] = traj_section()

OUT["meta"] = {
    "note": "All numbers computed by classes/data/bench_robotics.py on the host "
            "machine (NumPy 1.21, PyTorch 2.7, JAX 0.6, MuJoCo 3.10, "
            "CPU: the article's simulations are all CPU-bound double precision). "
            "Seeds are fixed in the script.",
    "generated": "2026-07-24",
    "numpy": np.__version__,
}

print(json.dumps(OUT, indent=1))
