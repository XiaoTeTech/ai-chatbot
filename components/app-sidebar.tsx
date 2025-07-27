'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useAppConfig } from '@/lib/hooks/use-app-config';
import { useState } from 'react';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { config } = useAppConfig();
  const [showDownloadDiv, setShowDownloadDiv] = useState(false);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <Image src="/images/icon.png" width={30} height={30} alt="Logo" />
              <span
                style={{ transform: 'translateX(-10px)' }}
                className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer"
              >
                小特
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">新对话</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        {/* 下载 App 提示 */}
        {config?.store_url && (
          <div className="px-2 pb-2">
            <div
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-blue-500 bg-white hover:bg-blue-50 transition-colors group relative"
              onMouseEnter={() => setShowDownloadDiv(true)}
              onMouseLeave={() => setShowDownloadDiv(false)}
            >
              <div className="flex items-center justify-center w-8 h-8 bg-white rounded-md border border-blue-200">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-600"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-900">
                    下载 App
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium text-white bg-blue-500 rounded-full">
                    NEW
                  </span>
                </div>
              </div>
              {/* 下载信息弹出层 */}
              {showDownloadDiv && (
                <div className="absolute bottom-full left-0 right-0 mb-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <div className="item" id="download-ai">
                    <img
                      className="w-16 h-16 mx-auto mb-3 rounded-lg"
                      src="https://xiaote.com/xiaote_box_store/assets/download/xiaote ai.png"
                      alt="小特 AI"
                    />
                    <div className="text-center text-sm font-medium text-gray-900 mb-2">
                      小特 AI 手机仪表盘
                    </div>
                    <div className="text-center text-xs text-gray-600 mb-4 leading-relaxed">
                      主界面 App，提供仪表显示、语音助手、车控等交互功能
                    </div>
                    <div className="flex gap-2 mb-4">
                      <a
                        id="download-ai-ios"
                        href="https://apps.apple.com/us/app/id6741570580"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <img
                          src="https://xiaote.com/xiaote_box_store/assets/download/Download.png"
                          alt="Download on App Store"
                          className="w-full h-auto"
                        />
                      </a>
                      <a
                        id="download-ai-android"
                        href="https://xiaote.com/release/ai/xiaote_ai-1.1.0(25).apk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <img
                          src="https://xiaote.com/xiaote_box_store/assets/download/Download-1.png"
                          alt="Download APK"
                          className="w-full h-auto"
                        />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
    </Sidebar>
  );
}
