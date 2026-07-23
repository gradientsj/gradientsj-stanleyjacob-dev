"""Taxonomy for the coursework section.

Single source of truth: `tools/generate_classes.py` renders `classes/index.html`
from this list, and the authoring agents take their assignment (slug, title,
scope, anchor references) from the same entries. Adding a page means adding an
entry here and re-running the generator.

Fields per article:
  slug     directory under /classes/
  title    <h1> and index link text
  blurb    index-page one-liner: what the page actually covers
  tags     short chips shown on the index row
"""

GROUPS = [
    {
        "id": "ml-foundations",
        "name": "Machine learning foundations",
        "intro": "The mathematical core: what a learning algorithm is, why it "
                 "generalizes, how to fit one, and how to reason under uncertainty "
                 "when the model is a graph of random variables rather than a "
                 "single predictor.",
        "articles": [
            {
                "slug": "statistical-learning",
                "title": "Statistical learning: from least squares to the exponential family",
                "blurb": "Supervised learning derived end to end: the normal equations and their "
                         "geometry, logistic regression and Newton's method, generalized linear "
                         "models from the exponential family, generative vs discriminative "
                         "classifiers, kernels and the representer theorem, the bias-variance "
                         "decomposition, and EM derived as a lower-bound maximization.",
                "tags": ["GLMs", "Kernels", "EM"],
            },
            {
                "slug": "ai-principles",
                "title": "Search, constraint satisfaction, and the classical AI toolkit",
                "blurb": "The pre-deep-learning half of AI that still decides real systems: "
                         "uniform-cost and A* with admissible heuristics proved optimal, "
                         "minimax with alpha-beta and expectimax, MDP value and policy "
                         "iteration, constraint satisfaction with arc consistency, Bayesian "
                         "networks and particle filtering, and where each one shows up inside "
                         "a modern agent stack.",
                "tags": ["A*", "MDPs", "CSPs"],
            },
            {
                "slug": "learning-theory",
                "title": "Learning theory: uniform convergence, margins, and why overparameterized models generalize",
                "blurb": "Concentration inequalities built from scratch, PAC learning and VC "
                         "dimension, Rademacher complexity, margin bounds that explain boosting "
                         "and SVMs, algorithmic stability, the implicit bias of gradient descent, "
                         "and the double-descent picture that broke the classical story.",
                "tags": ["VC dim", "Rademacher", "Double descent"],
            },
            {
                "slug": "deep-learning-engineering",
                "title": "Making deep networks train: initialization, normalization, and the tuning loop",
                "blurb": "The practical mechanics of getting a network to converge: signal "
                         "propagation and He/Xavier initialization derived from variance "
                         "analysis, batch/layer/RMS normalization compared, residual streams, "
                         "optimizer and schedule choice, regularization, and a systematic "
                         "error-analysis loop for deciding what to fix next.",
                "tags": ["Init", "Norms", "Schedules"],
            },
            {
                "slug": "probabilistic-graphical-models",
                "title": "Probabilistic graphical models: representation, inference, and learning",
                "blurb": "Bayesian networks and Markov random fields, d-separation and the "
                         "independence semantics, exact inference by variable elimination and "
                         "the junction tree, loopy belief propagation as a variational method, "
                         "MCMC and variational inference, structure learning, and the line from "
                         "these ideas to modern latent-variable models.",
                "tags": ["Inference", "Variational", "MCMC"],
            },
        ],
    },
    {
        "id": "language-generative",
        "name": "Language, generative, and multimodal models",
        "intro": "How the modern generative stack is actually built: tokenizers and "
                 "attention up through pretraining at scale, diffusion, alignment, "
                 "and the multimodal models that share one architecture across "
                 "text, image, audio, and graphs.",
        "articles": [
            {
                "slug": "language-models-from-scratch",
                "title": "Building a language model from scratch: tokenizer to trained checkpoint",
                "blurb": "The full pipeline with nothing hidden behind a library: BPE "
                         "implemented and analyzed, a transformer with RoPE, SwiGLU, RMSNorm, "
                         "and grouped-query attention, FlashAttention's tiling derived, "
                         "data-parallel/tensor-parallel/pipeline sharding and FSDP, scaling "
                         "laws and compute-optimal budgeting, mixture-of-experts routing, and "
                         "an inference path with paged KV cache and speculative decoding.",
                "tags": ["BPE", "FSDP", "Scaling laws"],
                "featured": True,
            },
            {
                "slug": "nlp-deep-learning",
                "title": "Neural NLP: word vectors, attention, and the road to pretrained transformers",
                "blurb": "Word2vec and GloVe derived with their gradients, recurrent models and "
                         "the vanishing-gradient analysis that motivated LSTMs, seq2seq and the "
                         "attention mechanism that replaced it, subword tokenization, BERT-style "
                         "masked pretraining vs autoregressive pretraining, and the fine-tuning "
                         "and prompting regimes that followed.",
                "tags": ["word2vec", "Seq2seq", "BERT"],
            },
            {
                "slug": "natural-language-understanding",
                "title": "Natural language understanding: semantics, grounding, and honest evaluation",
                "blurb": "Contextual representations and what probing does and does not show, "
                         "natural language inference and the annotation artifacts that inflate "
                         "it, retrieval-augmented and open-domain question answering, "
                         "compositional generalization, adversarial and contrast sets, and how "
                         "to build a benchmark whose numbers survive contact with a new model.",
                "tags": ["NLI", "RAG", "Evaluation"],
            },
            {
                "slug": "speech-and-spoken-language",
                "title": "Speech: signal processing, CTC, and end-to-end spoken language models",
                "blurb": "From the waveform up: framing, the STFT, and mel filterbanks derived; "
                         "HMM-GMM recognition as the historical baseline; CTC with its forward "
                         "algorithm and gradient worked out; RNN-transducer for streaming; "
                         "Whisper-style encoder-decoder ASR; speaker diarization; neural audio "
                         "codecs; and text-to-speech from Tacotron to diffusion vocoders.",
                "tags": ["CTC", "RNN-T", "Whisper"],
            },
            {
                "slug": "sequence-models-state-spaces",
                "title": "Long sequences: state-space models, linear attention, and subquadratic architectures",
                "blurb": "Why quadratic attention becomes the binding constraint, the HiPPO "
                         "initialization and the S4 kernel derived, Mamba's selective scan and "
                         "its hardware-aware parallel form, linear attention as an RNN in "
                         "disguise, RWKV and RetNet, hybrid architectures, and the associative "
                         "recall tasks where each design actually breaks.",
                "tags": ["S4", "Mamba", "Linear attention"],
            },
            {
                "slug": "deep-generative-models",
                "title": "Deep generative models: autoregressive, latent variable, flow, and score based",
                "blurb": "One framework for the whole family: the ELBO derived twice for VAEs, "
                         "normalizing flows and the change-of-variables formula, autoregressive "
                         "likelihood models, energy-based models with contrastive divergence, "
                         "score matching and the connection between denoising score matching "
                         "and diffusion, plus how each family trades off likelihood, sample "
                         "quality, and sampling speed.",
                "tags": ["VAE", "Flows", "Score matching"],
            },
            {
                "slug": "generative-adversarial-networks",
                "title": "Adversarial generative modeling: minimax games, stability, and image translation",
                "blurb": "The minimax objective and its optimal discriminator, why the original "
                         "loss saturates and what the non-saturating and Wasserstein variants "
                         "fix, gradient penalties and spectral normalization, progressive and "
                         "style-based generators, conditional and cycle-consistent translation, "
                         "FID and its failure modes, and where GANs still beat diffusion.",
                "tags": ["WGAN-GP", "StyleGAN", "CycleGAN"],
            },
            {
                "slug": "diffusion-and-large-vision-models",
                "title": "Diffusion and large vision models: forward process to few-step samplers",
                "blurb": "Diffusion derived from both the variational and score-based views and "
                         "shown to be the same model, DDPM and DDIM sampling, classifier-free "
                         "guidance, the probability-flow ODE and its solvers, latent diffusion, "
                         "flow matching and rectified flow, consistency and distillation methods "
                         "for few-step sampling, diffusion transformers, and controllable "
                         "generation.",
                "tags": ["DDPM", "Flow matching", "DiT"],
                "featured": True,
            },
            {
                "slug": "multimodal-foundation-models",
                "title": "Multimodal models: contrastive pretraining, fusion, and any-to-any generation",
                "blurb": "CLIP's contrastive objective and its temperature, cross-attention vs "
                         "early fusion vs adapter bridging, vision-language models from "
                         "Flamingo to native multimodal transformers, audio and video encoders, "
                         "unified tokenization across modalities, alignment and hallucination in "
                         "multimodal settings, and how to evaluate a model that reads and draws.",
                "tags": ["CLIP", "VLMs", "Fusion"],
            },
            {
                "slug": "applied-generative-ai",
                "title": "Applied generative AI: adaptation, retrieval, agents, and serving",
                "blurb": "Turning a pretrained model into a product: parameter-efficient "
                         "fine-tuning with LoRA and QLoRA derived, instruction tuning, RLHF and "
                         "DPO, quantization and distillation for serving, retrieval pipelines "
                         "with chunking and reranking, tool use and agent loops, structured "
                         "decoding, evaluation harnesses, and the cost model behind each choice.",
                "tags": ["LoRA", "DPO", "Serving"],
            },
            {
                "slug": "graph-machine-learning",
                "title": "Graph machine learning: message passing, expressiveness, and scale",
                "blurb": "Node embeddings from random walks, the message-passing framework with "
                         "GCN, GraphSAGE, and GAT derived, the Weisfeiler-Lehman expressiveness "
                         "bound and what it forbids, over-smoothing and over-squashing, graph "
                         "transformers with positional encodings, heterogeneous and knowledge "
                         "graphs, sampling for billion-edge graphs, and molecular and "
                         "recommendation applications.",
                "tags": ["GNNs", "WL test", "Scaling"],
            },
        ],
    },
    {
        "id": "rl-decisions",
        "name": "Reinforcement learning and sequential decision making",
        "intro": "Acting under uncertainty: the theory of MDPs, the deep RL "
                 "algorithms that made it work on pixels and robots, and the "
                 "meta-learning and self-improvement loops now driving language "
                 "model post-training.",
        "articles": [
            {
                "slug": "reinforcement-learning-fundamentals",
                "title": "Reinforcement learning foundations: MDPs, value iteration, and regret",
                "blurb": "Markov decision processes and the Bellman equations, contraction "
                         "mapping proofs for value and policy iteration, Monte Carlo vs "
                         "temporal-difference learning, function approximation and the deadly "
                         "triad, exploration from epsilon-greedy through UCB and posterior "
                         "sampling with their regret bounds, batch and offline RL, and policy "
                         "gradient theory.",
                "tags": ["Bellman", "TD", "Regret"],
            },
            {
                "slug": "deep-reinforcement-learning",
                "title": "Deep reinforcement learning: policy gradients, off-policy control, and RL for language models",
                "blurb": "REINFORCE derived from the likelihood ratio with baselines and GAE, "
                         "TRPO's trust region and PPO's clipped surrogate, DQN and its "
                         "stabilizers, DDPG/TD3/SAC and the maximum-entropy framework, "
                         "model-based RL and Dreamer, offline RL with CQL and IQL, imitation "
                         "and inverse RL, and RLHF/GRPO as the same algorithms applied to "
                         "token-level MDPs.",
                "tags": ["PPO", "SAC", "GRPO"],
                "featured": True,
            },
            {
                "slug": "advanced-rl-topics",
                "title": "Advanced reinforcement learning: hierarchy, multi-agent, and safe exploration",
                "blurb": "Options and hierarchical RL with the semi-MDP framework, successor "
                         "features and transfer, multi-agent learning and equilibrium concepts, "
                         "self-play and population training, distributional RL, exploration by "
                         "intrinsic motivation, constrained MDPs and safe RL, and the "
                         "reproducibility problems that plague the field's benchmarks.",
                "tags": ["Options", "Multi-agent", "Safe RL"],
            },
            {
                "slug": "decision-making-under-uncertainty",
                "title": "Decision making under uncertainty: belief states, POMDPs, and value of information",
                "blurb": "Utility theory and decision networks, exact and approximate POMDP "
                         "solutions from alpha vectors to POMCP, belief updates and filtering, "
                         "Monte Carlo tree search with UCT derived, value of information, "
                         "Gaussian processes and Bayesian optimization for expensive decisions, "
                         "and validation of safety-critical policies.",
                "tags": ["POMDP", "MCTS", "Bayes opt"],
            },
            {
                "slug": "meta-learning-and-multitask",
                "title": "Multi-task and meta-learning: shared structure, fast adaptation, and in-context learning",
                "blurb": "Multi-task architectures and the gradient-conflict problem, MAML's "
                         "second-order gradients derived with first-order approximations, "
                         "prototypical and metric-based few-shot learning, black-box and "
                         "in-context meta-learners, task distributions and the meta-overfitting "
                         "trap, continual learning and catastrophic forgetting, and why in-context "
                         "learning in large models is meta-learning that emerged for free.",
                "tags": ["MAML", "Few-shot", "In-context"],
            },
            {
                "slug": "self-improving-agents",
                "title": "Self-improving agents: verifiable rewards, search over reasoning, and self-critique",
                "blurb": "Chain-of-thought as a latent variable, self-consistency and best-of-n "
                         "with their scaling behavior, process vs outcome reward models, "
                         "rejection sampling and expert iteration, RL with verifiable rewards, "
                         "self-critique and debate, memory and skill libraries, tool-augmented "
                         "reasoning, test-time compute scaling laws, and the reward-hacking "
                         "failure modes each loop invites.",
                "tags": ["CoT", "RLVR", "Test-time"],
            },
            {
                "slug": "general-game-playing",
                "title": "Game playing: search, self-play, and learned evaluation",
                "blurb": "Game description as logic and the general-game-playing problem, "
                         "minimax with alpha-beta and modern search enhancements, Monte Carlo "
                         "tree search from bandits to UCT, AlphaZero's policy-value network and "
                         "self-play loop derived, MuZero's learned model, imperfect-information "
                         "games and counterfactual regret minimization, and what transfers from "
                         "games to real decision problems.",
                "tags": ["MCTS", "AlphaZero", "CFR"],
            },
        ],
    },
    {
        "id": "systems",
        "name": "Systems, architecture, and data at scale",
        "intro": "Where performance actually comes from: the machine underneath, "
                 "the concurrency model on top of it, and the data systems that "
                 "make terabytes tractable.",
        "articles": [
            {
                "slug": "computer-architecture",
                "title": "Computer architecture: from logic gates to out-of-order superscalars and GPUs",
                "blurb": "Built bottom up: digital logic and timing, the single-cycle and "
                         "pipelined datapath with hazards and forwarding, branch prediction, "
                         "caches and the full memory hierarchy with worked AMAT arithmetic, "
                         "virtual memory and TLBs, out-of-order execution with Tomasulo, "
                         "superscalar and speculation, cache coherence and memory consistency "
                         "models, SIMD, and the GPU as a throughput machine, ending at "
                         "systolic-array accelerators and the roofline model.",
                "tags": ["Pipelining", "Caches", "Roofline"],
                "featured": True,
            },
            {
                "slug": "advanced-systems-architecture",
                "title": "Advanced architecture: memory systems, accelerators, and the roofline in practice",
                "blurb": "Modern DRAM and HBM internals, prefetching and memory-level "
                         "parallelism, non-uniform memory access, interconnects from PCIe to "
                         "NVLink, tensor cores and systolic arrays with their dataflow "
                         "taxonomy, sparsity and quantization support in hardware, "
                         "performance counters and how to read a profile, and measured H100 "
                         "roofline numbers from this machine.",
                "tags": ["HBM", "Tensor cores", "NUMA"],
            },
            {
                "slug": "parallel-computing",
                "title": "Parallel computing: from Amdahl's law to CUDA kernels that saturate an H100",
                "blurb": "Parallel decomposition and the cost of communication, Amdahl and "
                         "Gustafson worked numerically, SPMD and ISPC-style vectorization, "
                         "work-efficient parallel algorithms (scan, reduce, sort), the CUDA "
                         "execution model with warps, occupancy, and coalescing, shared-memory "
                         "tiling for matmul, warp shuffles and reductions, Triton kernels, "
                         "attention kernel design, and measured bandwidth and TFLOPS from an "
                         "H100 on this machine.",
                "tags": ["CUDA", "Triton", "Roofline"],
                "featured": True,
            },
            {
                "slug": "concurrent-systems-programming",
                "title": "Concurrency across four languages: threads, processes, and memory models in Rust, C++, C, and Python",
                "blurb": "One concurrency curriculum written four times: processes and the "
                         "fork/exec/wait model, POSIX threads and C++ std::thread, Rust's "
                         "Send/Sync and how the borrow checker eliminates data races at compile "
                         "time, atomics and the acquire/release memory model, lock-free "
                         "queues, Python's GIL and the free-threaded build, async/await and "
                         "event loops, and measured throughput comparisons across all four.",
                "tags": ["Rust", "C++", "Atomics"],
            },
            {
                "slug": "operating-systems",
                "title": "Operating systems: processes, virtual memory, file systems, and the kernel boundary",
                "blurb": "The kernel's core abstractions built up: process and thread "
                         "implementation, context switching and scheduling from round-robin to "
                         "CFS and EEVDF, synchronization primitives implemented from atomics, "
                         "virtual memory with page tables and replacement policies, file "
                         "systems and journaling, I/O and the block layer, containers as "
                         "namespaces and cgroups, and virtualization.",
                "tags": ["Scheduling", "Paging", "Filesystems"],
            },
            {
                "slug": "computer-networks",
                "title": "Computer networks: congestion control, datacenter fabrics, and modern transport",
                "blurb": "The layered model with the arguments for and against it, reliable "
                         "delivery and TCP's congestion control derived including the "
                         "throughput equation, BBR's model-based alternative, queueing and "
                         "active queue management, datacenter topologies and load balancing, "
                         "RDMA and collective communication for distributed training, QUIC and "
                         "HTTP/3, and software-defined networking.",
                "tags": ["TCP/BBR", "RDMA", "QUIC"],
            },
            {
                "slug": "databases",
                "title": "Databases: relational algebra, query optimization, transactions, and modern engines",
                "blurb": "The relational model and algebra with SQL as its surface, storage "
                         "layouts row vs column, B-trees and LSM trees compared with their "
                         "write amplification math, join algorithms and cost-based query "
                         "optimization worked through an example plan, transactions and "
                         "isolation levels with the anomalies each permits, ARIES recovery, "
                         "multi-version concurrency control, distributed consensus and "
                         "sharding, and vector search as a first-class index type.",
                "tags": ["Query plans", "MVCC", "LSM"],
            },
            {
                "slug": "mining-massive-datasets",
                "title": "Mining massive datasets: streaming, hashing, and algorithms that fit in one pass",
                "blurb": "Algorithms for data that does not fit in memory: MapReduce and its "
                         "cost model, similarity search with minhash and locality-sensitive "
                         "hashing derived with the S-curve, frequent itemsets and A-Priori, "
                         "streaming with Bloom filters, Count-Min, HyperLogLog, and reservoir "
                         "sampling (with the error bounds proved), PageRank and random walks "
                         "with teleport, recommendation systems and matrix factorization, "
                         "submodular maximization, and large-scale clustering.",
                "tags": ["LSH", "Streaming", "PageRank"],
                "featured": True,
            },
            {
                "slug": "compilers-and-program-analysis",
                "title": "Compilers and program analysis: SSA, dataflow, and the optimizations that matter for ML",
                "blurb": "Front end through back end: parsing, intermediate representations and "
                         "SSA construction, dataflow analysis as a lattice fixed point with "
                         "worked iterations, loop transformations including tiling and fusion, "
                         "register allocation by graph coloring, instruction scheduling, "
                         "polyhedral analysis, and how XLA, TorchInductor, and Triton apply all "
                         "of it to tensor programs.",
                "tags": ["SSA", "Dataflow", "XLA"],
            },
            {
                "slug": "programming-languages",
                "title": "Programming languages: type systems, semantics, and what ownership buys you",
                "blurb": "Operational semantics and the progress/preservation proof, lambda "
                         "calculus and type inference with Hindley-Milner unification worked by "
                         "hand, polymorphism and subtyping, algebraic data types and pattern "
                         "matching, effects and monads, linear and affine types as the theory "
                         "behind Rust's ownership, gradual typing, and memory-safety guarantees "
                         "compared across languages.",
                "tags": ["Type theory", "HM inference", "Ownership"],
            },
        ],
    },
    {
        "id": "algorithms-theory",
        "name": "Algorithms, theory, optimization, and security",
        "intro": "The analytical core: how to design an algorithm and prove it "
                 "works, how to optimize a function or a combinatorial structure, "
                 "and how to build systems that stay correct against an adversary.",
        "articles": [
            {
                "slug": "algorithm-design-and-analysis",
                "title": "Algorithm design: divide and conquer, greedy, dynamic programming, and flow",
                "blurb": "The design paradigms with their proof techniques: asymptotic analysis "
                         "and the master theorem applied, divide and conquer with recurrences "
                         "solved, greedy algorithms proved correct by exchange arguments, "
                         "dynamic programming derived from optimal substructure, graph "
                         "algorithms including shortest paths and minimum spanning trees, "
                         "maximum flow with min-cut duality, and NP-completeness with "
                         "reductions worked in full.",
                "tags": ["DP", "Max-flow", "NP-hardness"],
            },
            {
                "slug": "advanced-data-structures",
                "title": "Advanced data structures: amortization, persistence, and succinct representations",
                "blurb": "Structures worth knowing past the interview set: amortized analysis "
                         "by potential functions, balanced trees and splay trees with their "
                         "access-time proof, Fibonacci heaps, union-find with the inverse "
                         "Ackermann bound, range-query structures and the sparse table, "
                         "persistence, van Emde Boas and word-level parallelism, hashing "
                         "theory from universal families to cuckoo hashing, and succinct rank "
                         "and select.",
                "tags": ["Amortized", "Persistence", "Succinct"],
            },
            {
                "slug": "modern-algorithmic-toolbox",
                "title": "The modern algorithmic toolbox: sketching, spectral methods, and randomization",
                "blurb": "The techniques that show up in ML systems: hashing and the "
                         "Johnson-Lindenstrauss lemma proved, sketching and streaming, the "
                         "singular value decomposition and low-rank approximation, spectral "
                         "graph theory and clustering, linear programming and duality, "
                         "gradient descent and its convergence rates, sampling and MCMC "
                         "mixing, and compressed sensing.",
                "tags": ["JL lemma", "Spectral", "LP duality"],
            },
            {
                "slug": "combinatorial-optimization",
                "title": "Optimization: convexity, duality, and the algorithms behind every trainer",
                "blurb": "Convex sets and functions with the conditions that certify them, "
                         "Lagrangian duality and KKT worked on examples, gradient descent "
                         "convergence rates under smoothness and strong convexity, "
                         "acceleration and why Nesterov's rate is optimal, proximal and "
                         "stochastic methods, Adam and adaptive preconditioning analyzed, "
                         "interior-point methods, submodular optimization, and integer "
                         "programming with relaxation and rounding.",
                "tags": ["Duality", "KKT", "Convergence"],
            },
            {
                "slug": "computer-security",
                "title": "Computer security: memory corruption, web attacks, and defense in depth",
                "blurb": "Attacks understood well enough to defend against: buffer overflows "
                         "and return-oriented programming with the stack drawn out, "
                         "ASLR/DEP/stack canaries and their bypasses, the browser security "
                         "model with XSS, CSRF, and injection, authentication and session "
                         "management, sandboxing and isolation, side channels including "
                         "Spectre, supply-chain risk, and the security of ML systems including "
                         "prompt injection and model extraction.",
                "tags": ["Memory safety", "Web", "Side channels"],
            },
            {
                "slug": "cryptography",
                "title": "Cryptography: from one-time pads to authenticated encryption and zero knowledge",
                "blurb": "Definitions first: perfect secrecy and its limits, pseudorandom "
                         "generators and functions, block ciphers and modes with the "
                         "chosen-plaintext game, message authentication and authenticated "
                         "encryption done right, hash functions and Merkle trees, number "
                         "theory for public-key crypto with RSA and Diffie-Hellman derived, "
                         "elliptic curves, TLS as a case study, zero-knowledge proofs and "
                         "commitments, and post-quantum lattice cryptography.",
                "tags": ["AEAD", "Public key", "ZK"],
            },
            {
                "slug": "numerical-methods",
                "title": "Numerical methods for machine learning: conditioning, factorizations, and stability",
                "blurb": "Why numerical code fails and how to write code that does not: "
                         "floating point and catastrophic cancellation with concrete "
                         "reproductions, conditioning and backward stability, LU, QR, "
                         "Cholesky, and SVD with when each applies, iterative solvers "
                         "including conjugate gradient derived, eigenvalue algorithms, "
                         "automatic differentiation forward and reverse mode implemented, "
                         "Newton and quasi-Newton methods, and mixed-precision arithmetic on "
                         "modern hardware.",
                "tags": ["Conditioning", "QR/SVD", "Autodiff"],
            },
        ],
    },
    {
        "id": "graphics-vision",
        "name": "Graphics, rendering, and 3D representations",
        "intro": "Making and understanding images: the physics of light transport, "
                 "the pipeline that renders sixty frames a second, the simulation "
                 "that moves things believably, and the neural representations that "
                 "reconstruct a scene from photographs.",
        "articles": [
            {
                "slug": "rendering-foundations",
                "title": "Graphics foundations: transforms, rasterization, shading, and ray tracing",
                "blurb": "The pipeline derived: homogeneous coordinates and the model-view-"
                         "projection chain multiplied out, rasterization with edge functions "
                         "and depth buffering, barycentric interpolation and perspective "
                         "correction, texture mapping with mipmapping and filtering, the "
                         "physically based shading model and the rendering equation, "
                         "ray-triangle intersection and acceleration structures, and modern "
                         "GPU pipeline stages.",
                "tags": ["MVP", "Rasterization", "BRDF"],
            },
            {
                "slug": "interactive-graphics",
                "title": "Interactive rendering: the real-time GPU pipeline and its budget",
                "blurb": "Rendering under a 16-millisecond budget: the GPU graphics pipeline "
                         "stage by stage, deferred and forward-plus shading, shadow mapping "
                         "and its artifacts, ambient occlusion and global illumination "
                         "approximations, temporal antialiasing and upsampling, level of "
                         "detail and culling, compute shaders, and hardware ray tracing with "
                         "denoising.",
                "tags": ["Deferred", "TAA", "RTX"],
            },
            {
                "slug": "animation-and-simulation",
                "title": "Animation and physical simulation: from keyframes to cloth and fluids",
                "blurb": "Motion that looks right: interpolation and quaternion rotation, "
                         "skeletal animation and skinning, numerical integration and stability "
                         "with explicit vs implicit schemes compared, mass-spring and finite "
                         "element deformation, rigid body dynamics with collision response, "
                         "cloth and hair, fluid simulation from the Navier-Stokes equations, "
                         "position-based dynamics, and differentiable simulation for learning.",
                "tags": ["Integrators", "FEM", "Fluids"],
            },
            {
                "slug": "physically-based-rendering",
                "title": "Physically based rendering: Monte Carlo light transport and variance reduction",
                "blurb": "The rendering equation solved properly: radiometry defined, Monte "
                         "Carlo integration with importance sampling and its variance "
                         "analysis, path tracing with Russian roulette, bidirectional and "
                         "photon-based methods, multiple importance sampling derived, "
                         "microfacet BSDFs, subsurface scattering and participating media, "
                         "sampling patterns, and differentiable rendering.",
                "tags": ["Path tracing", "MIS", "BSDF"],
            },
            {
                "slug": "neural-3d-representations",
                "title": "Neural 3D: radiance fields, Gaussian splatting, and learned geometry",
                "blurb": "Reconstructing and generating 3D: classical structure from motion "
                         "and multi-view geometry, implicit surfaces and signed distance "
                         "fields, NeRF's volume rendering integral derived and discretized, "
                         "positional encoding and hash grids, 3D Gaussian splatting and its "
                         "rasterizer, mesh and point cloud networks, generative 3D via score "
                         "distillation, and the evaluation metrics that mislead.",
                "tags": ["NeRF", "Splatting", "SDF"],
            },
        ],
    },
    {
        "id": "robotics",
        "name": "Robotics and embodied intelligence",
        "intro": "From the kinematic chain and its control law up to the "
                 "vision-language-action models that now drive manipulation, "
                 "including the human-in-the-loop problems that make deployment hard.",
        "articles": [
            {
                "slug": "robot-kinematics-and-control",
                "title": "Robot manipulation: kinematics, dynamics, and operational-space control",
                "blurb": "The manipulator worked out in full: rigid-body transforms and "
                         "forward kinematics, the Jacobian and its singularities, inverse "
                         "kinematics by damped least squares, Lagrangian dynamics for a "
                         "two-link arm derived by hand, joint-space and operational-space "
                         "control with stability arguments, impedance and force control, "
                         "trajectory generation, and the redundancy null space.",
                "tags": ["Jacobian", "Dynamics", "Impedance"],
            },
            {
                "slug": "advanced-manipulation",
                "title": "Advanced manipulation: contact, grasping, and whole-body control",
                "blurb": "Where manipulation gets hard: contact modeling and friction cones, "
                         "grasp quality metrics and force closure, hybrid force-position "
                         "control, compliant assembly and the peg-in-hole problem, whole-body "
                         "and multi-arm coordination, task and motion planning, dexterous "
                         "in-hand manipulation, and tactile sensing.",
                "tags": ["Grasping", "Contact", "TAMP"],
            },
            {
                "slug": "interactive-robotics",
                "title": "Interactive robotics: human models, shared autonomy, and learning from people",
                "blurb": "Robots that act around people: human motion prediction, game-"
                         "theoretic interaction models, inverse reinforcement learning and "
                         "reward inference from demonstrations and preferences, shared "
                         "autonomy and arbitration, legibility versus predictability, active "
                         "querying, trust and transparency, and safety guarantees under "
                         "uncertainty about human intent.",
                "tags": ["IRL", "Shared autonomy", "Safety"],
            },
            {
                "slug": "collaborative-robotics",
                "title": "Collaborative and multi-robot systems: coordination, allocation, and consensus",
                "blurb": "Many robots, one objective: distributed consensus and formation "
                         "control with their convergence proofs, task allocation via auctions "
                         "and matching, multi-robot path planning and conflict-based search, "
                         "coverage and exploration, communication constraints and "
                         "decentralized estimation, multi-agent RL for teams, and safety in "
                         "shared human-robot workspaces.",
                "tags": ["Consensus", "MAPF", "Auctions"],
            },
            {
                "slug": "embodied-foundation-models",
                "title": "Embodied foundation models: imitation, diffusion policies, and vision-language-action",
                "blurb": "The learning-based robot stack as it stands now: behavior cloning "
                         "and the covariate-shift problem with DAgger's bound, action "
                         "chunking, diffusion policies derived for action sequences, "
                         "vision-language-action models and cross-embodiment training, "
                         "sim-to-real and domain randomization, world models for planning, "
                         "large-scale robot datasets, and evaluation protocols that survive "
                         "real hardware.",
                "tags": ["Diffusion policy", "VLA", "Sim2real"],
            },
        ],
    },
    {
        "id": "applied-domains",
        "name": "Applied domains, product, and interfaces",
        "intro": "Where the models meet a domain and a user: genomics and "
                 "biomedicine, audio and music, and the design and engineering of "
                 "the applications people actually touch.",
        "articles": [
            {
                "slug": "deep-learning-genomics",
                "title": "Deep learning for genomics and biomedicine: sequence models, structure, and causality",
                "blurb": "Biology as a sequence-modeling problem: the central dogma stated for "
                         "engineers, convolutional and transformer models for regulatory "
                         "genomics, variant effect prediction, protein language models, "
                         "structure prediction from coevolution through attention-based "
                         "folding and diffusion-based design, single-cell representation "
                         "learning, multi-omics integration, causal inference and Mendelian "
                         "randomization, and interpretability where the science is the point.",
                "tags": ["Protein LMs", "Folding", "Single-cell"],
            },
            {
                "slug": "audio-signal-processing",
                "title": "Audio signal processing: spectral analysis, filters, and synthesis",
                "blurb": "The DSP under every audio model: sampling and aliasing, the DFT and "
                         "FFT derived, windowing and spectral leakage, filter design FIR and "
                         "IIR with the z-transform, the phase vocoder and time-frequency "
                         "manipulation, pitch and formant analysis, physical modeling and "
                         "digital waveguides, reverberation, and the perceptual coding ideas "
                         "behind lossy audio.",
                "tags": ["FFT", "Filters", "Vocoder"],
            },
            {
                "slug": "computational-music-analysis",
                "title": "Computational music analysis: pitch, rhythm, structure, and generation",
                "blurb": "Music as structured signal and symbol: pitch detection and chroma "
                         "features, beat tracking and tempo estimation, chord recognition and "
                         "key finding, source separation, symbolic representations and music "
                         "theory encoded computationally, structural segmentation, "
                         "similarity and recommendation, and generative music from Markov "
                         "chains to transformer and diffusion models.",
                "tags": ["Chroma", "Beat tracking", "Separation"],
            },
            {
                "slug": "ios-swiftui",
                "title": "Modern iOS: SwiftUI, concurrency, and on-device machine learning",
                "blurb": "Building an app the current way: SwiftUI's declarative model and its "
                         "state system (@State, @Observable, bindings), navigation and layout, "
                         "Swift concurrency with async/await and actors, data persistence with "
                         "SwiftData, networking and error handling, testing and performance "
                         "instrumentation, on-device inference with Core ML and the Neural "
                         "Engine, and the App Store release path.",
                "tags": ["SwiftUI", "Actors", "Core ML"],
            },
            {
                "slug": "product-design",
                "title": "Product design for engineers: research, prototyping in Figma, and evaluation",
                "blurb": "The design process an engineer can actually run: needfinding and "
                         "interviews, problem framing and how-might-we, structured ideation, "
                         "low- to high-fidelity prototyping in Figma with auto layout, "
                         "components, variants, and prototyping interactions, design systems "
                         "and tokens, visual and typographic fundamentals, accessibility, "
                         "usability testing and its sample-size math, and AI-assisted design "
                         "workflows.",
                "tags": ["Figma", "Prototyping", "Usability"],
            },
            {
                "slug": "modern-web-development",
                "title": "Modern web development: rendering models, state, and shipping fast pages",
                "blurb": "The current stack from first principles: the browser rendering path "
                         "and the layout/paint/composite pipeline, client vs server vs static "
                         "rendering and streaming with React Server Components, state "
                         "management and data fetching, TypeScript at the API boundary, "
                         "authentication and sessions, edge deployment and caching, Core Web "
                         "Vitals with the measurements that move them, and accessibility as a "
                         "correctness property.",
                "tags": ["RSC", "TypeScript", "Web Vitals"],
            },
        ],
    },
]


def all_articles():
    for g in GROUPS:
        for a in g["articles"]:
            yield g, a


def slugs():
    return [a["slug"] for _, a in all_articles()]


if __name__ == "__main__":
    n = 0
    for g in GROUPS:
        print(f"{g['name']}: {len(g['articles'])}")
        n += len(g["articles"])
    print("total:", n)
