import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';

export const Overview = () => {
  const { data: session } = useSession();

  const currentHour = new Date().getHours();

  let greeting: string;
  if (currentHour >= 5 && currentHour < 9) {
    greeting = '早上好';
  } else if (currentHour >= 9 && currentHour < 12) {
    greeting = '上午好';
  } else if (currentHour >= 12 && currentHour < 19) {
    greeting = '下午好';
  } else {
    greeting = '晚上好';
  }

  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
         {greeting}，{session?.user?.name || '用户'}！
</p>
      </div>
    </motion.div>
  );
};