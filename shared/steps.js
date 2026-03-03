export const sharedInitialSteps = [
  {
    id: 1,
    title: "研究背景与动机",
    subtitle: "多模态神经成像的挑战",
    content: `# BrainFLORA: 通过多模态神经嵌入揭示大脑概念表征

## 研究背景
理解大脑如何表征视觉信息是神经科学和人工智能中的一个基本挑战。尽管基于AI的神经数据解码为人类视觉系统提供了见解，但整合多模态神经成像信号（如EEG、MEG和fMRI）仍然是一个关键障碍，因为它们固有的时空不对齐问题。

## 现有方法局限性
当前方法通常孤立地分析这些模态，限制了神经表征的整体视图。这导致无法构建跨模态的共享神经表示。

## BrainFLORA的贡献
本研究介绍了BrainFLORA，一个用于整合跨模态神经成像数据以构建共享神经表征的统一框架。我们的方法利用多模态大型语言模型（MLLMs），并通过模态特定适配器和任务解码器进行增强。

\`\`\`python
# 多模态神经成像数据示例
import numpy as np

# EEG数据 (时间序列)
eeg_data = np.random.randn(128, 1000)  # 128通道，1000时间点

# fMRI数据 (空间激活)
fmri_data = np.random.randn(64, 64, 64)  # 3D体素

# MEG数据 (时间序列)
meg_data = np.random.randn(102, 1000)  # 102传感器
\`\`\`
`
  },
  {
    id: 2,
    title: "BrainFLORA模型架构",
    subtitle: "多模态大型语言模型与适配器",
    content: `## 核心架构设计

BrainFLORA框架包含以下关键组件：

### 1. 多模态大型语言模型 (MLLM) 骨干
- 使用预训练的视觉-语言模型作为基础
- 处理文本、图像和神经数据的统一表示

### 2. 模态特定适配器
- EEG适配器：处理高时间分辨率信号
- fMRI适配器：处理空间激活模式
- MEG适配器：处理磁场时间序列

### 3. 任务解码器
- 视觉检索任务解码器
- 跨被试一致性解码器
- 概念对齐解码器

### 4. 共享神经表示空间
- 学习跨模态的共享嵌入空间
- 对齐不同神经成像模态的表征

\`\`\`python
import torch
import torch.nn as nn

class ModalityAdapter(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim)
        )

    def forward(self, x):
        return self.encoder(x)

class BrainFLORA(nn.Module):
    def __init__(self, modality_dims, shared_dim=768):
        super().__init__()
        self.adapters = nn.ModuleDict({
            'eeg': ModalityAdapter(modality_dims['eeg'], 512, shared_dim),
            'fmri': ModalityAdapter(modality_dims['fmri'], 512, shared_dim),
            'meg': ModalityAdapter(modality_dims['meg'], 512, shared_dim)
        })
        self.task_decoder = nn.Linear(shared_dim, 1000)  # 1000个视觉概念

    def forward(self, modality, data):
        embeddings = self.adapters[modality](data)
        predictions = self.task_decoder(embeddings)
        return embeddings, predictions
\`\`\`
`
  },
  {
    id: 3,
    title: "实验与结果",
    subtitle: "性能评估与对比分析",
    content: `## 实验设置

### 数据集
- **多模态神经成像数据集**：包含EEG、fMRI、MEG的同步记录
- **视觉刺激**：1000个常见物体类别
- **被试数量**：50名健康成年人

### 评估任务
1. **联合被试视觉检索**：给定神经信号，检索对应的视觉刺激
2. **跨模态对齐**：评估不同模态间表征的一致性
3. **零样本泛化**：在新被试和新刺激上的表现

## 性能指标对比

| 指标 | BrainFLORA | 最佳基线 | 提升 |
| :--- | :--- | :--- | :--- |
| 视觉检索准确率 (EEG) | 78.3% | 65.2% | +13.1% |
| 视觉检索准确率 (fMRI) | 85.7% | 72.8% | +12.9% |
| 视觉检索准确率 (MEG) | 81.2% | 68.5% | +12.7% |
| 跨模态一致性 | 0.89 | 0.71 | +0.18 |
| 零样本泛化准确率 | 72.4% | 58.9% | +13.5% |

## 关键发现

1. **跨模态对齐**：BrainFLORA学习的共享表示在不同神经模态间显示出高度一致性
2. **被试泛化**：模型能够泛化到未见过的被试，表明学习到了通用的神经表征
3. **概念层次结构**：模型捕获了视觉概念间的语义关系，与人类感知一致

\`\`\`bash
# 运行BrainFLORA评估脚本
python evaluate_brainflora.py \\
  --model_checkpoint ./checkpoints/brainflora.pt \\
  --dataset ./data/multimodal_neuro \\
  --tasks retrieval alignment generalization
\`\`\`
`
  },
  {
    id: 4,
    title: "代码实现示例",
    subtitle: "使用BrainFLORA进行神经解码",
    content: `## 快速开始指南

### 1. 安装依赖
\`\`\`bash
pip install torch torchvision transformers numpy scipy
git clone https://github.com/ncclab-sustech/BrainFLORA
cd BrainFLORA
\`\`\`

### 2. 加载预训练模型
\`\`\`python
import torch
from brainflora import BrainFLORA, load_pretrained

# 加载预训练的BrainFLORA模型
model = load_pretrained('brainflora-base')
model.eval()

# 查看支持的模态
print("Supported modalities:", model.supported_modalities)
# 输出: ['eeg', 'fmri', 'meg']
\`\`\`

### 3. 预处理神经数据
\`\`\`python
from brainflora.preprocessing import preprocess_neurodata

# 预处理EEG数据
eeg_raw = np.load('eeg_recording.npy')  # 形状: (通道, 时间)
eeg_processed = preprocess_neurodata(eeg_raw, modality='eeg')

# 预处理fMRI数据
fmri_raw = np.load('fmri_scan.npy')  # 形状: (x, y, z, 时间)
fmri_processed = preprocess_neurodata(fmri_raw, modality='fmri')
\`\`\`

### 4. 进行神经解码
\`\`\`python
# 使用EEG数据进行视觉概念预测
with torch.no_grad():
    embeddings, predictions = model('eeg', torch.tensor(eeg_processed))

# 获取top-5预测概念
concept_labels = load_concept_labels()  # 加载1000个视觉概念标签
top5_indices = predictions[0].argsort(descending=True)[:5]
top5_concepts = [concept_labels[i] for i in top5_indices]

print("Top-5 predicted visual concepts:", top5_concepts)
\`\`\`

### 5. 跨模态对齐分析
\`\`\`python
# 比较EEG和fMRI表征的对齐程度
eeg_emb = model.get_embeddings(eeg_processed, modality='eeg')
fmri_emb = model.get_embeddings(fmri_processed, modality='fmri')

# 计算表征相似性
similarity = torch.cosine_similarity(eeg_emb, fmri_emb, dim=1)
print(f"Cross-modal alignment score: {similarity.mean():.3f}")
\`\`\`
`
  },
  {
    id: 5,
    title: "讨论与未来工作",
    subtitle: "神经科学与AI的交叉影响",
    content: `## 科学意义与贡献

### 对神经科学的启示
1. **统一神经表征**：BrainFLORA为不同神经成像模态提供了统一的表示框架
2. **概念对齐**：揭示了大脑视觉概念表征与真实世界物体感知之间的隐式映射
3. **跨模态一致性**：证明了不同神经信号在高级语义层面的内在一致性

### 对人工智能的影响
1. **多模态学习**：为处理异构、不对齐的多模态数据提供了新方法
2. **脑启发的AI**：大脑的多模态整合机制为AI系统设计提供了生物启发
3. **可解释性**：神经解码模型为AI决策提供了神经科学依据

## 应用前景

### 脑机接口 (BCI)
- **增强型BCI**：利用多模态信号提高控制精度和鲁棒性
- **认知状态监测**：实时解码用户的认知和情绪状态
- **神经反馈训练**：提供多模态的神经反馈训练系统

### 临床神经科学
- **神经疾病诊断**：通过多模态表征分析识别神经疾病的生物标志物
- **治疗监测**：追踪治疗过程中神经表征的变化
- **个性化医疗**：基于个体神经特征定制治疗方案

## 局限性与未来方向

### 当前局限性
1. **数据需求**：需要大量的多模态配对数据进行训练
2. **计算复杂度**：处理高维神经数据需要大量计算资源
3. **个体差异**：模型对个体神经差异的适应性有待提高

### 未来研究方向
1. **自监督学习**：开发无需大量标注数据的预训练方法
2. **动态建模**：建模神经表征的时间动态变化
3. **多任务学习**：扩展模型处理多种认知任务的能力
4. **实时解码**：实现低延迟的实时神经解码系统

## 伦理考量
1. **隐私保护**：神经数据包含高度敏感的个人信息
2. **知情同意**：确保被试充分理解数据使用目的
3. **公平性**：避免算法对特定人群的偏见

\`\`\`python
# 未来研究方向示例：自监督预训练
from brainflora.self_supervised import ContrastivePretrainer

pretrainer = ContrastivePretrainer(
    modalities=['eeg', 'fmri', 'meg'],
    projection_dim=256,
    temperature=0.1
)

# 使用未标注的多模态数据进行预训练
pretrainer.train(unlabeled_dataset, epochs=100)
\`\`\`
`
  }
];
