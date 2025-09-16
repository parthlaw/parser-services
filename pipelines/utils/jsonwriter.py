import json

class JsonWriter:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.file = open(file_path, "w+")
        self.file.write("[")

    def writerow(self, data: dict):
        self.file.write(json.dumps(data) + ",")

    def close(self):
        # remove the last comma
        self.file.seek(0, 2)  # Go to end of file
        if self.file.tell() > 1:  # If file has content beyond "["
            self.file.seek(self.file.tell() - 1)  # Go back one character
            if self.file.read(1) == ",":  # If last character is comma
                self.file.seek(self.file.tell() - 1)  # Go back to comma position
                self.file.truncate()  # Remove the comma
        self.file.write("]")
        self.file.close()