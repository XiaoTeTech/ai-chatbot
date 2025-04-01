import { Artifact } from '@/components/create-artifact';
import { DiffView } from '@/components/diffview';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { Editor } from '@/components/text-editor';
import {
  ClockRewind,
  CopyIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
} from '@/components/icons';
import { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

// 定义文本工件元数据接口
interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

// 导出文本工件实例
export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  // 工件类型为文本
  kind: 'text',
  // 文本工件的描述，适用于起草文章和邮件等文本内容
  description: '适用于文本内容，如起草文章和邮件等。',
  // 初始化函数，在文档创建时调用
  initialize: async ({ documentId, setMetadata }) => {
    // 获取文档的建议列表
    const suggestions = await getSuggestions({ documentId });

    // 设置元数据，包含建议列表
    setMetadata({
      suggestions,
    });
  },
  // 处理流式数据的函数
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    // 如果流式数据类型为建议
    if (streamPart.type === 'suggestion') {
      // 更新元数据，添加新的建议
      setMetadata((metadata) => {
        return {
          suggestions: [
            ...metadata.suggestions,
            streamPart.content as Suggestion,
          ],
        };
      });
    }

    // 如果流式数据类型为文本增量
    if (streamPart.type === 'text-delta') {
      // 更新工件内容
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          // 追加新的文本内容
          content: draftArtifact.content + (streamPart.content as string),
          // 根据内容长度和状态更新可见性
          isVisible:
            draftArtifact.status === 'streaming' &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          // 设置工件状态为流式传输中
          status: 'streaming',
        };
      });
    }
  },
  // 渲染工件内容的函数
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    // 如果正在加载，显示骨架屏
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    // 如果处于差异查看模式
    if (mode === 'diff') {
      // 获取旧版本和新版本的内容
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      // 渲染差异视图
      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    // 渲染文本编辑器和建议列表
    return (
      <>
        <div className="flex flex-row py-8 md:p-20 px-4">
          <Editor
            content={content}
            suggestions={metadata ? metadata.suggestions : []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
          />

          {metadata &&
          metadata.suggestions &&
          metadata.suggestions.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
  // 工件操作按钮列表
  actions: [
    {
      // 时钟回退图标
      icon: <ClockRewind size={18} />,
      // 操作描述：查看变化
      description: '查看变化',
      // 点击事件处理函数
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      // 判断操作是否禁用的函数
      isDisabled: ({ currentVersionIndex, setMetadata }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      // 撤销图标
      icon: <UndoIcon size={18} />,
      // 操作描述：查看之前的版本
      description: '查看之前的版本',
      // 点击事件处理函数
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      // 判断操作是否禁用的函数
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      // 重做图标
      icon: <RedoIcon size={18} />,
      // 操作描述：查看下一个版本
      description: '查看下一个版本',
      // 点击事件处理函数
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      // 判断操作是否禁用的函数
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      // 复制图标
      icon: <CopyIcon size={18} />,
      // 操作描述：复制
      description: '复制',
      // 点击事件处理函数
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('已复制到剪贴板！');
      },
    },
  ],
  // 工具栏按钮列表
  toolbar: [
    {
      // 笔图标
      icon: <PenIcon />,
      // 操作描述：进行最终润色
      description: '进行最终润色',
      // 点击事件处理函数
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            '请进行最终润色，检查语法，添加章节标题以优化结构，并确保内容流畅易读。',
        });
      },
    },
    {
      // 消息图标
      icon: <MessageIcon />,
      // 操作描述：请求建议
      description: '请求建议',
      // 点击事件处理函数
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            '请提供可以改进文章写作的建议。',
        });
      },
    },
  ],
});