import React, { useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, Clock, Target, Award, 
  Calendar, CheckCircle2, XCircle, BarChart2,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  BookOpen, MessageSquare, Zap, Star
} from 'lucide-react';
import { motion } from 'motion/react';

interface Attempt {
  id: string;
  type: 'quiz' | 'story' | 'special';
  title: string;
  date: string;
  score: number;
  total: number;
  timeSpent: number;
  topic: string;
  missedItems?: string[];
}

interface DashboardProps {
  attempts: Attempt[];
  totalXP: number;
  streak: number;
  weakVocabulary?: Record<string, number>;
}

export const Dashboard: React.FC<DashboardProps> = ({ attempts, totalXP, streak, weakVocabulary = {} }) => {
  const metrics = useMemo(() => {
    if (attempts.length === 0) return null;

    const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
    const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
    const overallAccuracy = (totalCorrect / totalQuestions) * 100;
    const avgTimePerQuestion = attempts.reduce((acc, curr) => acc + curr.timeSpent, 0) / (totalQuestions || 1);
    
    // Performance by topic
    const topicStats: Record<string, { correct: number; total: number }> = {};
    attempts.forEach(a => {
      if (!topicStats[a.topic]) topicStats[a.topic] = { correct: 0, total: 0 };
      topicStats[a.topic].correct += a.score;
      topicStats[a.topic].total += a.total;
    });

    const topicData = Object.entries(topicStats).map(([name, stats]) => ({
      name,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      total: stats.total
    })).sort((a, b) => b.accuracy - a.accuracy);

    const strugglingTopics = topicData.filter(t => t.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy);

    // Weakest vocabulary (most misses)
    const topStruggles = Object.entries(weakVocabulary)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    // Accuracy over time (last 10 attempts)
    const timelineData = [...attempts].reverse().slice(-10).map((a, i) => ({
      name: `Attempt ${i + 1}`,
      accuracy: Math.round((a.score / a.total) * 100),
      date: new Date(a.date).toLocaleDateString()
    }));

    return {
      overallAccuracy: Math.round(overallAccuracy),
      avgTime: Math.round(avgTimePerQuestion * 10) / 10,
      topicData,
      timelineData,
      strugglingTopics,
      topStruggles,
      totalAttempts: attempts.length
    };
  }, [attempts, weakVocabulary]);

  if (!metrics) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
        <BarChart2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No data yet</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-2">Complete some quizzes or stories to see your progress dashboard!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm"
        >
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
            <Target className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.overallAccuracy}%</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Accuracy</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm"
        >
          <div className="w-10 h-10 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.avgTime}s</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Sec/Question</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm"
        >
          <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-slate-800">{streak}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Day Streak</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm"
        >
          <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-3">
            <Award className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-slate-800">{totalXP}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total XP</p>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accuracy Timeline */}
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Accuracy Trend</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last 10 Attempts</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  hide 
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value}%`, 'Accuracy']}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Topic Performance */}
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Topic Performance</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accuracy by Unit</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topicData.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  fontSize={10} 
                  stroke="#64748b"
                  tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value}%`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" radius={[0, 8, 8, 0]}>
                  {metrics.topicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.accuracy >= 80 ? '#10b981' : entry.accuracy >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Struggles / Vocabulary */}
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Review Vocabulary</h3>
          </div>
          
          {metrics.topStruggles.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">You've missed these items most often. Consider focusing on them in your next session.</p>
              <div className="flex flex-wrap gap-2">
                {metrics.topStruggles.map((item, i) => (
                  <div key={i} className="px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center gap-2 group hover:border-red-200 transition-colors">
                    <span className="font-bold text-slate-700">{item.word}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{item.count} misses</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">No weak vocabulary points yet. Great work!</p>
            </div>
          )}
        </div>

        {/* Struggles / Topics */}
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Focus Topics</h3>
          </div>

          {metrics.strugglingTopics.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Units with low accuracy scores. Reviewing these will boost your overall performance.</p>
              <div className="space-y-3">
                {metrics.strugglingTopics.slice(0, 3).map((topic, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-700">{topic.name}</h4>
                      <p className="text-xs text-slate-400 font-medium uppercase mt-0.5">Accuracy: {topic.accuracy}%</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-100 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
              <Star className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">All units looking strong! Ready for new challenges.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">Recent Activity</h3>
          <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Topic</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Score</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.slice(0, 5).map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        a.type === 'quiz' ? 'bg-emerald-50 text-emerald-500' : 
                        a.type === 'story' ? 'bg-sky-50 text-sky-500' : 'bg-amber-50 text-amber-500'
                      }`}>
                        {a.type === 'quiz' ? <BarChart2 className="w-4 h-4" /> : 
                         a.type === 'story' ? <BookOpen className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-slate-700">{a.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{a.topic}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${a.score / a.total >= 0.8 ? 'bg-emerald-500' : a.score / a.total >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(a.score / a.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{a.score}/{a.total}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{Math.floor(a.timeSpent / 60)}m {a.timeSpent % 60}s</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(a.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
