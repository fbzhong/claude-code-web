# 测试终端功能的命令

在登录后的终端中，可以尝试以下命令：

1. **基础命令测试**：
   ```bash
   echo "Hello from Claude Web Terminal!"
   pwd
   ls -la
   ```

2. **颜色测试**：
   ```bash
   echo -e "\033[31mRed\033[0m \033[32mGreen\033[0m \033[33mYellow\033[0m \033[34mBlue\033[0m"
   ```

3. **交互式程序测试**：
   ```bash
   # Python 交互式
   python3
   >>> print("Python works!")
   >>> exit()
   
   # Node.js 交互式
   node
   > console.log("Node.js works!")
   > .exit
   ```

4. **Claude Code 测试**（如果已安装）：
   ```bash
   claude --version
   claude code
   ```

5. **文件操作测试**：
   ```bash
   echo "Test file from web terminal" > test.txt
   cat test.txt
   rm test.txt
   ```

如果这些命令都能正常工作，说明终端功能已经完全实现！